using BookingApi.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Database: SQL Server (SSMS) by default via "DefaultConnection"; falls back
// to InMemory when no connection string is configured (demo / quickstart).
// ---------------------------------------------------------------------------
var conn = builder.Configuration.GetConnectionString("DefaultConnection");
if (!string.IsNullOrEmpty(conn))
{
    builder.Services.AddDbContext<BookingDbContext>(o => o.UseSqlServer(conn));
}
else
{
    builder.Services.AddDbContext<BookingDbContext>(o => o.UseInMemoryDatabase("booking-demo"));
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Booking System API",
        Version = "v1",
        Description = "Booking System REST API — Swagger documentation & testing. " +
                      "Demo auth: send `X-User-Id` header (demo-admin / demo-user). " +
                      "Production replaces this with Firebase ID-token validation.",
    });
});

var app = builder.Build();

// ---------------------------------------------------------------------------
// Swagger "lock" (security note):
//   * Development        → Swagger always visible
//   * Production         → hidden UNLESS ALLOW_SWAGGER=true (env var) AND the
//                          X-Swagger-Key request header matches SWAGGER_KEY.
//                          This keeps the API surface private by default while
//                          letting the client demo it with a shared key.
// ---------------------------------------------------------------------------
var exposeSwagger = app.Environment.IsDevelopment() ||
                    builder.Configuration["ALLOW_SWAGGER"] == "true";
if (exposeSwagger)
{
    var swaggerKey = builder.Configuration["SWAGGER_KEY"] ?? "booking-demo-key";
    app.Use(async (context, next) =>
    {
        if (context.Request.Path.StartsWithSegments("/swagger") ||
            context.Request.Path.Value?.EndsWith("swagger.json") == true)
        {
            // Dev always passes; otherwise require the shared key header.
            if (!app.Environment.IsDevelopment() &&
                context.Request.Headers["X-Swagger-Key"] != swaggerKey)
            {
                context.Response.StatusCode = 401;
                await context.Response.WriteAsJsonAsync(new { error = "Swagger is locked. Provide X-Swagger-Key." });
                return;
            }
        }
        await next();
    });
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Booking System API v1"));
}

app.UseAuthorization();
app.MapControllers();

// Seed demo data on first run (idempotent).
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BookingDbContext>();
    await DbSeeder.SeedAsync(db);
}

app.Run();
