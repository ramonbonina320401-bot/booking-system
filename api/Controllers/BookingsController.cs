using BookingApi.Data;
using BookingApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookingApi.Controllers;

[ApiController]
[Route("api/bookings")]
public class BookingsController : ControllerBase
{
    private readonly BookingDbContext _db;
    public BookingsController(BookingDbContext db) => _db = db;

    /// <summary>Create a booking — status is forced to 'pending' server-side.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBookingDto body)
    {
        var uid = CurrentUid();
        if (string.IsNullOrEmpty(uid)) return Unauthorized(new { error = "Missing X-User-Id header." });

        var user = await _db.Users.FindAsync(uid);
        if (user is null) return Unauthorized(new { error = "User not found." });
        if (!user.IsActive) return StatusCode(403, new { error = "Account is deactivated." });
        if (!user.EmailVerified && string.IsNullOrEmpty(user.Phone))
            return StatusCode(403, new { error = "Verify your email or phone before booking." });

        var resource = await _db.Resources.FindAsync(body.ResourceId);
        if (resource is null) return NotFound(new { error = "Resource not found." });
        if (!resource.IsActive) return StatusCode(403, new { error = "Resource is not available." });

        // Maintenance + past-date checks.
        var maintenance = await _db.Settings.FindAsync("maintenance_mode");
        if (maintenance?.Value == "true")
            return StatusCode(503, new { error = "System is under maintenance." });
        if (body.StartTime <= DateTime.UtcNow)
            return BadRequest(new { error = "Start time must be in the future." });
        if (body.EndTime <= body.StartTime)
            return BadRequest(new { error = "End time must be after start time." });

        // Atomic anti-double-booking: UNIQUE (ResourceId, StartTime) — catch the
        // conflict. The explicit check keeps the InMemory demo provider honest
        // (it does not enforce unique indexes); SQL Server enforces via constraint.
        var startUtc = body.StartTime.ToUniversalTime();
        var exists = await _db.Bookings.AnyAsync(b =>
            b.ResourceId == body.ResourceId && b.StartTime == startUtc && b.Status != "cancelled");
        if (exists) return Conflict(new { error = "That slot is already taken." });

        var booking = new Booking
        {
            UserId = uid,
            ResourceId = body.ResourceId,
            StartTime = startUtc,
            EndTime = body.EndTime.ToUniversalTime(),
            Status = "pending", // never trust client status
            Notes = body.Notes,
        };

        _db.Bookings.Add(booking);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { error = "That slot is already taken." });
        }

        return Ok(new { id = booking.Id, status = booking.Status, startTime = booking.StartTime, endTime = booking.EndTime });
    }

    /// <summary>List your own bookings.</summary>
    [HttpGet("mine")]
    public async Task<IActionResult> Mine()
    {
        var uid = CurrentUid();
        var bookings = await _db.Bookings
            .Where(b => b.UserId == uid)
            .OrderByDescending(b => b.StartTime)
            .Select(b => new
            {
                b.Id, b.StartTime, b.EndTime, b.Status, b.Notes, b.ResourceId,
                ResourceName = _db.Resources.Where(r => r.Id == b.ResourceId).Select(r => r.Name).FirstOrDefault() ?? "Resource"
            })
            .ToListAsync();
        return Ok(bookings);
    }

    /// <summary>Admin: list all bookings with optional resource/status filter.</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid? resourceId, [FromQuery] string? status)
    {
        var query = _db.Bookings.AsQueryable();
        if (resourceId.HasValue) query = query.Where(b => b.ResourceId == resourceId.Value);
        if (!string.IsNullOrEmpty(status)) query = query.Where(b => b.Status == status);

        var bookings = await query
            .OrderByDescending(b => b.StartTime)
            .Select(b => new
            {
                b.Id, b.StartTime, b.EndTime, b.Status, b.Notes, b.ResourceId,
                ResourceName = _db.Resources.Where(r => r.Id == b.ResourceId).Select(r => r.Name).FirstOrDefault() ?? "Resource",
                b.UserId,
                UserName = _db.Users.Where(u => u.Id == b.UserId).Select(u => u.FullName).FirstOrDefault() ?? "User",
                UserPhone = _db.Users.Where(u => u.Id == b.UserId).Select(u => u.Phone).FirstOrDefault()
            })
            .ToListAsync();
        return Ok(bookings);
    }

    /// <summary>Owner: cancel a pending/confirmed booking.</summary>
    [HttpPatch("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var booking = await _db.Bookings.FindAsync(id);
        if (booking is null) return NotFound(new { error = "Booking not found." });
        if (booking.UserId != CurrentUid()) return StatusCode(403, new { error = "You can only cancel your own bookings." });
        if (booking.Status is not ("pending" or "confirmed"))
            return BadRequest(new { error = "Only pending or confirmed bookings can be cancelled." });

        booking.Status = "cancelled";
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, status = booking.Status });
    }

    /// <summary>Admin: confirm / complete / cancel a booking.</summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] StatusRequest body)
    {
        if (body.Status is not ("confirmed" or "completed" or "cancelled"))
            return BadRequest(new { error = "Invalid status." });

        var booking = await _db.Bookings.FindAsync(id);
        if (booking is null) return NotFound(new { error = "Booking not found." });

        booking.Status = body.Status;
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, status = booking.Status });
    }

    /// <summary>Admin: delete a booking.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var booking = await _db.Bookings.FindAsync(id);
        if (booking is null) return NotFound(new { error = "Booking not found." });

        _db.Bookings.Remove(booking);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    private string CurrentUid() => Request.Headers["X-User-Id"].ToString() ?? "";
}

public record CreateBookingDto(Guid ResourceId, DateTime StartTime, DateTime EndTime, string? Notes = null);
public record StatusRequest(string Status);
