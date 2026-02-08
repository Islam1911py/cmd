import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { id } = params

    // @ts-ignore - النموذج موجود في Prisma
    const advance = await db.staffAdvance.findUnique({
      where: { id }
    })

    if (!advance) {
      return NextResponse.json(
        { error: "Advance not found" },
        { status: 404 }
      )
    }

    if (advance.status === "DEDUCTED") {
      return NextResponse.json(
        { error: "Cannot delete deducted advances" },
        { status: 400 }
      )
    }

    // @ts-ignore - النموذج موجود في Prisma
    await db.staffAdvance.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[STAFF_ADVANCE_DELETE]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
