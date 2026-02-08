import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/invoices - List all invoices with their expenses
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      console.log("No session found")
      return NextResponse.json({ error: "Unauthorized: No session" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      console.log("User role:", session.user.role)
      return NextResponse.json({ error: "Unauthorized: Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const unitId = searchParams.get("unitId")
    const isPaidParam = searchParams.get("isPaid")

    // Build where clause
    const where: any = {}
    if (unitId) {
      where.unitId = unitId
    }
    if (isPaidParam !== null) {
      where.isPaid = isPaidParam === "true"
    }

    // Get all invoices with their associated data
    const invoices = await db.invoice.findMany({
      where,
      include: {
        unit: {
          include: {
            project: true
          }
        },
        ownerAssociation: true,
        expenses: {
          select: {
            id: true,
            description: true,
            amount: true,
            sourceType: true,
            date: true,
            createdAt: true
          }
        }
      },
      orderBy: { issuedAt: "desc" }
    })

    console.log("Total invoices fetched:", invoices.length)
    invoices.forEach(inv => {
      console.log(`Invoice ${inv.invoiceNumber}: ${inv.expenses?.length || 0} expenses`)
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json({ error: "Failed to fetch invoices", details: String(error) }, { status: 500 })
  }
}
