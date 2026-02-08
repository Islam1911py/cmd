import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// PATCH /api/invoices/[id] - Update invoice (mark as paid, etc)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { action, amount } = body

    // Check if invoice exists
    const existingInvoice = await db.invoice.findUnique({
      where: { id }
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (action === "mark-paid" || action === "pay") {
      // For backward compatibility, treat mark-paid as full payment
      const paymentAmount = action === "mark-paid" 
        ? existingInvoice.remainingBalance 
        : amount

      if (!paymentAmount || paymentAmount <= 0) {
        return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 })
      }

      if (paymentAmount > existingInvoice.remainingBalance) {
        return NextResponse.json({ error: "Payment exceeds remaining balance" }, { status: 400 })
      }

      // Update the remaining balance
      const newRemainingBalance = existingInvoice.remainingBalance - paymentAmount
      const newTotalPaid = (existingInvoice.totalPaid || 0) + paymentAmount
      const isPaidNow = newRemainingBalance <= 0

      const updatedInvoice = await db.invoice.update({
        where: { id },
        data: {
          totalPaid: newTotalPaid,
          remainingBalance: newRemainingBalance,
          isPaid: isPaidNow
        },
        include: {
          unit: {
            include: {
              project: true
            }
          },
          expenses: {
            select: {
              id: true,
              description: true,
              amount: true,
              sourceType: true
            }
          }
        }
      })

      // If fully paid, create a new open invoice for the same unit automatically
      if (isPaidNow) {
        const unit = await db.operationalUnit.findUnique({
          where: { id: existingInvoice.unitId }
        })

        if (unit) {
          // Find the OwnerAssociation for this unit
          const ownerAssociation = await db.ownerAssociation.findUnique({
            where: { unitId: unit.id }
          })

          if (ownerAssociation) {
            const newInvoiceNumber = `INV-${Date.now()}`
            await db.invoice.create({
              data: {
                invoiceNumber: newInvoiceNumber,
                type: "CLAIM",
                unitId: unit.id,
                ownerAssociationId: ownerAssociation.id,
                amount: 0,
                remainingBalance: 0,
                isPaid: false
              }
            })
          }
        }
      }

      return NextResponse.json(updatedInvoice)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error updating invoice:", error)
    return NextResponse.json(
      { error: "Failed to update invoice", details: String(error) },
      { status: 500 }
    )
  }
}
