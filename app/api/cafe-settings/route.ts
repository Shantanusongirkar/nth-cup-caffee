import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cafeSlug = searchParams.get("cafeSlug") || "nth-cup-demo";

  const prisma = getPrisma();
  const cafe = await prisma.cafe.findUnique({
    where: { slug: cafeSlug },
    select: { orderNotificationChannel: true },
  });

  if (!cafe) {
    // Fail safe to "BOTH" if the cafe lookup fails, so WhatsApp still opens
    // as a sane default rather than silently breaking checkout.
    return Response.json({ orderNotificationChannel: "BOTH" });
  }

  return Response.json({ orderNotificationChannel: cafe.orderNotificationChannel });
}