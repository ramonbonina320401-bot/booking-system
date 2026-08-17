using BookingApi.Data;
using BookingApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookingApi.Controllers;

[ApiController]
[Route("api/announcements")]
public class AnnouncementsController : ControllerBase
{
    private readonly BookingDbContext _db;
    public AnnouncementsController(BookingDbContext db) => _db = db;

    /// <summary>List announcements (signed-in users).</summary>
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var now = DateTime.UtcNow;
        var items = await _db.Announcements
            .Where(a => (a.StartDate == null || a.StartDate <= now) &&
                        (a.EndDate == null || a.EndDate >= now))
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
        return Ok(items);
    }

    /// <summary>Admin: post a notice or scheduled closure.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AnnouncementDto body)
    {
        if (string.IsNullOrWhiteSpace(body.Title)) return BadRequest(new { error = "Title is required." });
        if (body.Kind is not ("notice" or "closure")) return BadRequest(new { error = "Kind must be 'notice' or 'closure'." });

        var item = new Announcement
        {
            Title = body.Title.Trim(),
            Body = body.Body,
            Kind = body.Kind,
            StartDate = body.StartDate,
            EndDate = body.EndDate,
            CreatedBy = Request.Headers["X-User-Id"].ToString(),
        };
        _db.Announcements.Add(item);
        await _db.SaveChangesAsync();
        return Ok(item);
    }

    /// <summary>Admin: delete an announcement.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var item = await _db.Announcements.FindAsync(id);
        if (item is null) return NotFound(new { error = "Announcement not found." });

        _db.Announcements.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}

public record AnnouncementDto(string Title, string? Body = null, string Kind = "notice", DateTime? StartDate = null, DateTime? EndDate = null);
