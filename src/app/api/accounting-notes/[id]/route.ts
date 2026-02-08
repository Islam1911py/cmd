import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/accounting-notes/[id] - Get single accounting note
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string

    const note = await db.accountingNote.findUnique({
      where: { id },
      include: {
        unit: {
          include: {
            project: true
          }
        },
        project: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        convertedToExpense: {
          include: {
            recordedByUser: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    if (!note) {
      return NextResponse.json({ error: "Accounting note not found" }, { status: 404 })
    }

    // Check if user has access to this note
    if (role === "PROJECT_MANAGER") {
      // PMs can only see notes from their assigned projects
      const assignments = await db.projectAssignment.findMany({
        where: { userId: session.user.id },
        select: { projectId: true }
      })
      const projectIds = assignments.map(a => a.projectId)
      
      if (!projectIds.includes(note.unit.projectId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error("Error fetching accounting note:", error)
    return NextResponse.json(
      { error: "Failed to fetch accounting note" },
      { status: 500 }
    )
  }
}

// PATCH /api/accounting-notes/[id] - Update accounting note (record it)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string
    const userId = session.user.id

    // Check if note exists
    const existingNote = await db.accountingNote.findUnique({
      where: { id }
    })

    if (!existingNote) {
      return NextResponse.json({ error: "Accounting note not found" }, { status: 404 })
    }

    const body = await req.json()
    const { status } = body

    // Only Accountant and Admin can record accounting notes
    if (role !== "ACCOUNTANT" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Prepare update data
    const updateData: any = {}

    if (status === "CONVERTED") {
      // Get the unit with project info
      const unit = await db.operationalUnit.findUnique({
        where: { id: existingNote.unitId },
        include: { project: true }
      })

      if (!unit) {
        return NextResponse.json({ error: "Unit not found" }, { status: 404 })
      }

      // Find the OwnerAssociation for this unit
      const ownerAssociation = await db.ownerAssociation.findUnique({
        where: { unitId: existingNote.unitId }
      })

      if (!ownerAssociation) {
        return NextResponse.json({ error: "Owner association not found for this unit" }, { status: 404 })
      }

      // Find or create an open invoice for this unit
      let invoice = await db.invoice.findFirst({
        where: {
          unitId: existingNote.unitId,
          isPaid: false,
          type: "CLAIM"
        }
      })

      // If no open invoice, create one
      if (!invoice) {
        const invoiceNumber = `INV-${Date.now()}`
        invoice = await db.invoice.create({
          data: {
            invoiceNumber,
            type: "CLAIM",
            unitId: existingNote.unitId,
            ownerAssociationId: ownerAssociation.id,
            amount: 0,
            remainingBalance: 0
          }
        })
      }

      // Create UnitExpense and link it to the invoice
      const unitExpense = await db.unitExpense.create({
        data: {
          unitId: existingNote.unitId,
          description: existingNote.description,
          amount: existingNote.amount,
          sourceType: "OTHER",
          recordedByUserId: userId,
          claimInvoiceId: invoice.id
        }
      })

      // Update invoice amount
      await db.invoice.update({
        where: { id: invoice.id },
        data: {
          amount: {
            increment: existingNote.amount
          },
          remainingBalance: {
            increment: existingNote.amount
          }
        }
      })

      // Update accounting note with converted expense
      updateData.status = "CONVERTED"
      updateData.convertedAt = new Date()
      updateData.convertedToExpenseId = unitExpense.id
    } else if (status === "REJECTED") {
      updateData.status = "REJECTED"
      updateData.convertedAt = new Date()
    } else {
      return NextResponse.json({ error: "Invalid status. Use CONVERTED or REJECTED" }, { status: 400 })
    }

    // Update accounting note
    const note = await db.accountingNote.update({
      where: { id },
      data: updateData,
      include: {
        unit: {
          include: {
            project: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        convertedToExpense: {
          include: {
            recordedByUser: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error("Error updating accounting note:", error)
    return NextResponse.json(
      { error: "Failed to update accounting note", details: String(error) },
      { status: 500 }
    )
  }
}

// DELETE /api/accounting-notes/[id] - Delete accounting note (Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string

    // Only Admin can delete accounting notes
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.accountingNote.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Accounting note deleted successfully" })
  } catch (error) {
    console.error("Error deleting accounting note:", error)
    return NextResponse.json(
      { error: "Failed to delete accounting note" },
      { status: 500 }
    )
  }
}
