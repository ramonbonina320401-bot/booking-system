using BookingApi.Data;
using BookingApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookingApi.Controllers;

[ApiController]
[Route("api/settings")]
public class SettingsController : ControllerBase
{
    private readonly BookingDbContext _db;
    public SettingsController(BookingDbContext db) => _db = db;

    private static readonly string[] PublicKeys =
    {
        "app_name", "primary_color", "background_color", "accent_color",
        "maintenance_mode", "maintenance_message", "logo_url",
        "booking_open_hour", "booking_close_hour", "slot_duration_minutes",
        "booking_closed_days", "booking_reminder_minutes", "booking_reminder_days",
    };

    /// <summary>Public branding + availability settings (never tokens/secrets).</summary>
    [HttpGet("public")]
    public async Task<IActionResult> GetPublic()
    {
        var settings = await _db.Settings
            .Where(s => PublicKeys.Contains(s.Key))
            .ToDictionaryAsync(s => s.Key, s => s.Value);
        return Ok(settings);
    }

    /// <summary>Admin: read all settings (including Viber config).</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var settings = await _db.Settings.ToDictionaryAsync(s => s.Key, s => s.Value);
        return Ok(settings);
    }

    /// <summary>Admin: upsert settings.</summary>
    [HttpPut]
    public async Task<IActionResult> Put([FromBody] Dictionary<string, string?> values)
    {
        foreach (var (key, value) in values)
        {
            var item = await _db.Settings.FindAsync(key);
            if (item is null)
            {
                _db.Settings.Add(new SettingsItem { Key = key, Value = value, ValueType = "string", UpdatedAt = DateTime.UtcNow });
            }
            else
            {
                item.Value = value;
                item.UpdatedAt = DateTime.UtcNow;
            }
        }
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}
