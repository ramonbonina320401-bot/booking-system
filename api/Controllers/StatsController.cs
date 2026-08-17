using BookingApi.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookingApi.Controllers;

[ApiController]
public class StatsController : ControllerBase
{
    private readonly BookingDbContext _db;
    public StatsController(BookingDbContext db) => _db = db;

    /// <summary>Admin dashboard KPIs: totals, pending, upcoming, per-status counts.</summary>
    [HttpGet("api/admin/stats")]
    public async Task<IActionResult> Stats()
    {
        var now = DateTime.UtcNow;
        var total = await _db.Bookings.CountAsync();
        var pending = await _db.Bookings.CountAsync(b => b.Status == "pending");
        var upcoming = await _db.Bookings.CountAsync(b => b.Status == "confirmed" && b.StartTime >= now);
        var resources = await _db.Resources.CountAsync(r => r.IsActive);
        var users = await _db.Users.CountAsync();

        return Ok(new { total, pending, upcoming, resources, users });
    }

    /// <summary>Admin: immutable audit trail.</summary>
    [HttpGet("api/audit")]
    public async Task<IActionResult> Audit([FromQuery] int limit = 50)
    {
        var logs = await _db.AuditLog
            .OrderByDescending(a => a.CreatedAt)
            .Take(Math.Clamp(limit, 1, 200))
            .ToListAsync();
        return Ok(logs);
    }
}
