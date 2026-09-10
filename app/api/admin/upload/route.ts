import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface SessionUser {
  id?: string;
  role?: string;
  cafeId?: string;
}

function getSessionCafeId(session: Session | null | undefined): string | null {
  const user = session?.user as SessionUser | undefined;
  return user?.cafeId ?? null;
}

export async function POST(request: Request) {
  // Protected — same session check as the other /api/admin routes (defense in
  // depth on top of the proxy.ts matcher).
  const session = await getServerSession(authOptions);
  const cafeId = getSessionCafeId(session);
  if (!cafeId) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "INVALID_FORM_DATA", message: "Request must be multipart form data." },
      { status: 400 }
    );
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "INVALID_FILE", message: "Missing 'image' file in the upload request." },
      { status: 400 }
    );
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return Response.json(
      { error: "UNSUPPORTED_TYPE", message: "Unsupported file type. Use JPG, PNG, or WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return Response.json(
      { error: "FILE_TOO_LARGE", message: "Image is too large. Maximum size is 5 MB." },
      { status: 413 }
    );
  }

  try {
    const blob = await put(`products/${cafeId}/${Date.now()}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    // TODO: Delete the previous blob when a product's image is replaced (or on
    // product deletion), so replaced images don't accumulate forever and bloat
    // storage costs. Not needed for this pass — customers only ever see the
    // latest imageUrl.
    return Response.json({ url: blob.url }, { status: 201 });
  } catch (error) {
    console.error("Failed to upload product image:", error);
    return Response.json(
      { error: "UPLOAD_FAILED", message: "Failed to upload image. Please try again." },
      { status: 500 }
    );
  }
}