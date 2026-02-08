import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { normalizePhone } from "@/lib/phone"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const hasCanViewAllProjects = Object.prototype.hasOwnProperty.call(body, "canViewAllProjects")
    const hasWhatsappPhone = Object.prototype.hasOwnProperty.call(body, "whatsappPhone")
    const hasProjectIds = Object.prototype.hasOwnProperty.call(body, "projectIds")

    if (!hasCanViewAllProjects && !hasWhatsappPhone && !hasProjectIds) {
      return NextResponse.json(
        { error: "No valid fields provided" },
        { status: 400 }
      )
    }

    const updateData: Prisma.UserUpdateInput = {}

    if (hasCanViewAllProjects) {
      if (typeof body.canViewAllProjects !== "boolean") {
        return NextResponse.json(
          { error: "Invalid canViewAllProjects value" },
          { status: 400 }
        )
      }
      updateData.canViewAllProjects = body.canViewAllProjects
    }

    if (hasWhatsappPhone) {
      if (body.whatsappPhone !== null && typeof body.whatsappPhone !== "string") {
        return NextResponse.json(
          { error: "Invalid whatsappPhone value" },
          { status: 400 }
        )
      }
      const normalizedPhone = normalizePhone(body.whatsappPhone)
      updateData.whatsappPhone = normalizedPhone ? normalizedPhone : null
    }

    let projectIdsToAssign: string[] | undefined
    if (hasProjectIds) {
      if (!Array.isArray(body.projectIds)) {
        return NextResponse.json(
          { error: "projectIds must be an array" },
          { status: 400 }
        )
      }
      const filtered = body.projectIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
      projectIdsToAssign = Array.from(new Set(filtered))
    }

    const user = await db.$transaction(async (tx) => {
      if (projectIdsToAssign) {
        const validProjects = await tx.project.findMany({
          where: { id: { in: projectIdsToAssign } },
          select: { id: true }
        })
        const validProjectIds = new Set(validProjects.map((project) => project.id))
        const invalidProjects = projectIdsToAssign.filter((projectId) => !validProjectIds.has(projectId))
        if (invalidProjects.length > 0) {
          throw new Error("Invalid project IDs provided")
        }

        const existingAssignments = await tx.projectAssignment.findMany({
          where: { userId: id },
          select: { projectId: true }
        })
        const existingIds = new Set(existingAssignments.map((assignment) => assignment.projectId))

        const toDelete = Array.from(existingIds).filter((projectId) => !validProjectIds.has(projectId))
        if (toDelete.length > 0) {
          await tx.projectAssignment.deleteMany({
            where: {
              userId: id,
              projectId: { in: toDelete }
            }
          })
        }

        const toCreate = projectIdsToAssign.filter((projectId) => !existingIds.has(projectId))
        if (toCreate.length > 0) {
          await tx.projectAssignment.createMany({
            data: toCreate.map((projectId) => ({ userId: id, projectId })),
            skipDuplicates: true
          })
        }
      }

      const selectFields = {
        id: true,
        name: true,
        email: true,
        role: true,
        canViewAllProjects: true,
        whatsappPhone: true,
        assignedProjects: {
          select: {
            projectId: true,
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      } as const

      if (Object.keys(updateData).length > 0) {
        return tx.user.update({
          where: { id },
          data: updateData,
          select: selectFields
        })
      }

      const existingUser = await tx.user.findUnique({
        where: { id },
        select: selectFields
      })

      if (!existingUser) {
        throw new Error("User not found")
      }

      return existingUser
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error updating user permissions:", error)

    if (error instanceof Error) {
      if (error.message === "Invalid project IDs provided") {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      if (error.message === "User not found") {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
    }

    return NextResponse.json(
      { error: "Failed to update user", details: String(error) },
      { status: 500 }
    )
  }
}
