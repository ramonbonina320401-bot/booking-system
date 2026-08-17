using BookingApi.Models;
using Microsoft.EntityFrameworkCore;

namespace BookingApi.Data;

public static class DbSeeder
{
    /// <summary>Seed demo data if the database is empty. Idempotent.</summary>
    public static async Task SeedAsync(BookingDbContext db)
    {
        if (await db.Users.AnyAsync()) return;

        db.Users.AddRange(
            new User { Id = "demo-admin", FullName = "Admin User", Email = "admin@booking.test", EmailVerified = true, Role = "admin", SignInProvider = "email" },
            new User { Id = "demo-user", FullName = "Regular User", Email = "user@booking.test", EmailVerified = true, Role = "user", SignInProvider = "email" }
        );

        db.Resources.AddRange(
            new Resource { Name = "Meeting Room A", Description = "Small meeting room, seats 4." },
            new Resource { Name = "Meeting Room B", Description = "Large meeting room, seats 12." },
            new Resource { Name = "Projector", Description = "HD projector with HDMI input." }
        );

        db.Settings.AddRange(
            new SettingsItem { Key = "app_name", Value = "Booking System", ValueType = "string" },
            new SettingsItem { Key = "primary_color", Value = "#db2777", ValueType = "color" },
            new SettingsItem { Key = "background_color", Value = "#fafaf8", ValueType = "color" },
            new SettingsItem { Key = "accent_color", Value = "#f59e0b", ValueType = "color" },
            new SettingsItem { Key = "maintenance_mode", Value = "false", ValueType = "boolean" },
            new SettingsItem { Key = "maintenance_message", Value = "We are upgrading the system. Please check back in a few minutes.", ValueType = "string" },
            new SettingsItem { Key = "booking_open_hour", Value = "9", ValueType = "number" },
            new SettingsItem { Key = "booking_close_hour", Value = "17", ValueType = "number" },
            new SettingsItem { Key = "slot_duration_minutes", Value = "30", ValueType = "number" },
            new SettingsItem { Key = "booking_reminder_minutes", Value = "30", ValueType = "number" },
            new SettingsItem { Key = "booking_reminder_days", Value = "0", ValueType = "number" },
            new SettingsItem { Key = "booking_closed_days", Value = "", ValueType = "days" },
            new SettingsItem { Key = "viber_enabled", Value = "false", ValueType = "boolean" },
            new SettingsItem { Key = "viber_token", Value = "", ValueType = "string" },
            new SettingsItem { Key = "viber_admin_id", Value = "", ValueType = "string" }
        );

        await db.SaveChangesAsync();
    }
}
