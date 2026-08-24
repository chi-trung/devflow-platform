using System.Security.Cryptography;
using System.Text;

namespace DevFlow.Application.Features.GitHub;

public static class GitHubWebhookSignature
{
    public static string ComputeSha256(string secret, string message)
    {
        var keyBytes = Encoding.UTF8.GetBytes(secret);
        var messageBytes = Encoding.UTF8.GetBytes(message);
        using var hmac = new HMACSHA256(keyBytes);
        var hash = hmac.ComputeHash(messageBytes);
        return "sha256=" + Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static bool Verify(string secret, string message, string signature)
    {
        var expected = ComputeSha256(secret, message);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(signature));
    }
}
