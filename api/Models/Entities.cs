using System.ComponentModel.DataAnnotations;

namespace BookingApi.Models;

/// <summary>User profile — Id is the Firebase UID (no password stored here).</summary>
public class User
{
    [Key, MaxLength(128)] public string Id { get; set; } = "";
    [MaxLength(100)] public string FullName { get; set; } = "";
    [MaxLength(254)] public string? Email { get; set; }
    public bool EmailVerified { get; set; }
    [MaxLength(30)] public string? Phone { get; set; }
    [MaxLength(10)] public string Role { get; set; } = "user"; // admin | user
    public bool IsActive { get; set; } = true;
    public string? AvatarUrl { get; set; }
    [MaxLength(500)] public string? FcmToken { get; set; }
    [MaxLength(20)] public string? SignInProvider { get; set; } // email|google|facebook|phone
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public class Resource
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [MaxLength(100)] public string Name { get; set; } = "";
    [MaxLength(1000)] public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Booking
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [MaxLength(128)] public string UserId { get; set; } = "";
    public Guid ResourceId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    [MaxLength(20)] public string Status { get; set; } = "pending"; // pending|confirmed|cancelled|completed
    [MaxLength(500)] public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class SettingsItem
{
    [Key, MaxLength(50)] public string Key { get; set; } = "";
    public string? Value { get; set; }
    [MaxLength(10)] public string ValueType { get; set; } = "string"; // string|color|boolean|number|image|days
    [MaxLength(128)] public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class Announcement
{
    [Key] public Guid Id { get; set; } = Guid.NewGuid();
    [MaxLength(100)] public string Title { get; set; } = "";
    [MaxLength(2000)] public string? Body { get; set; }
    [MaxLength(10)] public string Kind { get; set; } = "notice"; // notice|closure
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [MaxLength(128)] public string? CreatedBy { get; set; }
}

public class AuditLog
{
    [Key] public long Id { get; set; }
    [MaxLength(50)] public string Action { get; set; } = "";
    [MaxLength(50)] public string TargetType { get; set; } = "";
    [MaxLength(200)] public string? TargetId { get; set; }
    [MaxLength(1000)] public string? Details { get; set; }
    [MaxLength(128)] public string? ActorUid { get; set; }
    [MaxLength(100)] public string? ActorName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
