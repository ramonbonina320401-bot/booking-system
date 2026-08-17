using Microsoft.EntityFrameworkCore;
using BookingApi.Models;

namespace BookingApi.Data;

public class BookingDbContext : DbContext
{
    public BookingDbContext(DbContextOptions<BookingDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Resource> Resources => Set<Resource>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<SettingsItem> Settings => Set<SettingsItem>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<AuditLog> AuditLog => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Anti-double-booking: one slot per resource per start time.
        // Mirrors the Firestore deterministic slot doc id + SQL UNIQUE constraint.
        modelBuilder.Entity<Booking>()
            .HasIndex(b => new { b.ResourceId, b.StartTime })
            .IsUnique();

        // A user must exist before a booking can reference them.
        modelBuilder.Entity<Booking>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Booking>()
            .HasOne<Resource>()
            .WithMany()
            .HasForeignKey(b => b.ResourceId)
            .OnDelete(DeleteBehavior.Restrict);

        // Audit log is append-only (no update/delete exposed).
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => a.CreatedAt);
    }
}
