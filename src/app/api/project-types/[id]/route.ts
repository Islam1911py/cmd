import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Check if new name already exists (excluding current)
    const existing = await db.projectType.findUnique({
      where: { name: name.trim() },
    })

    if (existing && existing.id !== params.id) {
      return NextResponse.json(
        { error: "Project type name already exists" },
        { status: 409 }
      )
    }

    const projectType = await db.projectType.update({
      where: { id: params.id },
      data: { name: name.trim() },
    })

    return NextResponse.json(projectType)
  } catch (error) {
    console.error("Error updating project type:", error)
    return NextResponse.json(
      { error: "Failed to update project type" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if any projects use this type
    const elementsCount = await db.projectElement.count({
      where: { typeId: params.id },
    })

    if (elementsCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete project type because it's in use",
          inUse: elementsCount,
        },
        { status: 409 }
      )
    }

    await db.projectType.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting project type:", error)
    return NextResponse.json(
      { error: "Failed to delete project type" },
      { status: 500 }
    )
  }
}
