import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";


// Hardcoded valid device tokens for testing
// In production, this would be stored in a database
const VALID_DEVICE_TOKENS = new Set([
  "jrdr_dev_dummy",  // Default dummy token from status endpoint
  "jrdr_dev_test_1", // Additional test tokens
  "jrdr_dev_test_2"
]);

// Mock user data mapped to device tokens
const MOCK_USERS = {
  "jrdr_dev_dummy": {
    id: "user_123",
    name: "Test User",
    email: "test@example.com",
    image: "https://cdn.discordapp.com/avatars/123456789/abcdef123456.png",
    discord_id: "123456789",
    discord_username: "testuser",
    discord_discriminator: "1234"
  },
  "jrdr_dev_test_1": {
    id: "user_456",
    name: "John Doe",
    email: "john@example.com",
    image: "https://example.com/avatar.png",
    discord_id: "987654321",
    discord_username: "johndoe",
    discord_discriminator: "5678"
  },
  "jrdr_dev_test_2": {
    id: "user_789",
    name: "Jane Smith",
    email: "jane@example.com",
    image: "https://example.com/jane-avatar.png",
    discord_id: "555666777",
    discord_username: "janesmith",
    discord_discriminator: "9999"
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deviceToken = searchParams.get("device_token");
  
  console.log("Fetching user profile for device token:", deviceToken);
  
  if (!deviceToken) {
    return NextResponse.json({ error: "Device token required" }, { status: 400 });
  }
  
  // Validate the device token
  if (!VALID_DEVICE_TOKENS.has(deviceToken)) {
    console.log("Invalid device token:", deviceToken);
    return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
  }
  
  // Get user data for the valid device token
  const userData = MOCK_USERS[deviceToken as keyof typeof MOCK_USERS];
  
  if (!userData) {
    console.log("No user data found for device token:", deviceToken);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  
  console.log("Returning user data for device token:", deviceToken);
  return NextResponse.json(userData);
}
