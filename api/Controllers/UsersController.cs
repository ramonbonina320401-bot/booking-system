using BookingApi.Data;
using BookingApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookingApi.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly BookingDbContext _db;
    public UsersController(BookingDbContext db) => _db = db;

    /// <summary>List all users with role, email, phone and booking count.</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q)
    {
        var users = await _db.Users
            .Where(u => string.IsNullOrEmpty(q) ||
                        u.FullName.Contains(q) || (u.Email ?? "").Contains(q))
            .Select(u => new
            {
                u.Id, u.FullName, u.Email, u.Phone, u.Role, u.IsActive, u.SignInProvider,
                BookingCount = _db.Bookings.Count(b => b.UserId == u.Id)
            })
            .OrderBy(u => u.FullName)
            .ToListAsync();
        return Ok(users);
    }

    /// <summary>Admin: change a user's role.</summary>
    [HttpPatch("{id}/role")]
    public async Task<IActionResult> ChangeRole(string id, [FromBody] RoleRequest body)
    {
        if (body.Role != "admin" && body.Role != "user")
            return BadRequest(new { error = "Role must be 'admin' or 'user'." });

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound(new { error = "User not found." });

        // Never demote yourself / never remove the last admin.
        if (id == CurrentUid() && body.Role == "user")
            return BadRequest(new { error = "You cannot change your own role." });

        user.Role = body.Role;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>Admin: deactivate or reactivate a user (deactivated users cannot book).</summary>
    [HttpPatch("{id}/active")]
    public async Task<IActionResult> SetActive(string id, [FromBody] ActiveRequest body)
    {
        if (id == CurrentUid())
            return BadRequest(new { error = "You cannot deactivate yourself." });

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound(new { error = "User not found." });

        user.IsActive = body.Active;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>Delete your own account (profile + bookings).</summary>
    [HttpDelete("me")]
    public async Task<IActionResult> DeleteMe()
    {
        var uid = CurrentUid();
        var user = await _db.Users.FindAsync(uid);
        if (user is null) return NotFound(new { error = "User not found." });

        _db.Bookings.RemoveRange(_db.Bookings.Where(b => b.UserId == uid));
        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    private string CurrentUid() => Request.Headers["X-User-Id"].ToString() ?? "";
}

public record RoleRequest(string Role);
public record ActiveRequest(bool Active);
