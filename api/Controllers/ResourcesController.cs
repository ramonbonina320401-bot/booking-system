using BookingApi.Data;
using BookingApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookingApi.Controllers;

[ApiController]
[Route("api/resources")]
public class ResourcesController : ControllerBase
{
    private readonly BookingDbContext _db;
    public ResourcesController(BookingDbContext db) => _db = db;

    /// <summary>Public list of resources (active only unless admin).</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool includeInactive = false)
    {
        var resources = await _db.Resources
            .Where(r => includeInactive || r.IsActive)
            .OrderBy(r => r.Name)
            .ToListAsync();
        return Ok(resources);
    }

    /// <summary>Admin: create a resource.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ResourceDto body)
    {
        if (string.IsNullOrWhiteSpace(body.Name)) return BadRequest(new { error = "Name is required." });
        if (body.Name.Length > 100) return BadRequest(new { error = "Name must be ≤ 100 chars." });

        var resource = new Resource { Name = body.Name.Trim(), Description = body.Description };
        _db.Resources.Add(resource);
        await _db.SaveChangesAsync();
        return Ok(resource);
    }

    /// <summary>Admin: update a resource.</summary>
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ResourceDto body)
    {
        var resource = await _db.Resources.FindAsync(id);
        if (resource is null) return NotFound(new { error = "Resource not found." });

        if (!string.IsNullOrWhiteSpace(body.Name)) resource.Name = body.Name.Trim();
        if (body.Description is not null) resource.Description = body.Description;
        if (body.IsActive is not null) resource.IsActive = body.IsActive.Value;
        await _db.SaveChangesAsync();
        return Ok(resource);
    }

    /// <summary>Admin: soft-delete (deactivate) a resource.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var resource = await _db.Resources.FindAsync(id);
        if (resource is null) return NotFound(new { error = "Resource not found." });

        resource.IsActive = false; // soft delete — keeps booking history intact
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}

public record ResourceDto(string Name, string? Description = null, bool? IsActive = null);
