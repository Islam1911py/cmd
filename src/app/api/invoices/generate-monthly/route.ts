import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin or Accountant access required" },
        { status: 403 }
      )
    }

    // Get current day of month (1-31)
    const today = new Date()
    const currentDay = today.getDate()
    const currentMonth = today.toISOString().substring(0, 7) // YYYY-MM

    console.log(`[Monthly Billing] Checking for units with billing day: ${currentDay}`)

    // Find all operational units where:
    // 1. monthlyBillingDay matches current day
    // 2. monthlyManagementFee > 0
    // 3. isActive = true
    const unitsToInvoice = await db.operationalUnit.findMany({
      where: {
        isActive: true,
        monthlyBillingDay: currentDay,
        monthlyManagementFee: {
          gt: 0
        }
      },
      include: {
        project: true,
        ownerAssociation: true
      }
    })

    console.log(`[Monthly Billing] Found ${unitsToInvoice.length} units to invoice`)

    const invoicesCreated: any[] = []
    const skipped: any[] = []

    for (const unit of unitsToInvoice) {
      // Check if invoice already exists for this unit in current month
      const existingInvoice = await db.invoice.findFirst({
        where: {
          unitId: unit.id,
          type: "MANAGEMENT_SERVICE",
          invoiceNumber: {
            contains: currentMonth
          }
        }
      })

      if (existingInvoice) {
        console.log(`[Monthly Billing] Skipping ${unit.code} - invoice already exists`)
        skipped.push({
          unitCode: unit.code,
          unitName: unit.name,
          reason: "Invoice already exists for this month"
        })
        continue
      }

      // Check if ownerAssociation exists
      if (!unit.ownerAssociation) {
        console.log(`[Monthly Billing] Skipping ${unit.code} - no owner association`)
        skipped.push({
          unitCode: unit.code,
          unitName: unit.name,
          reason: "No owner association found"
        })
        continue
      }

      // Generate invoice number: MGT-YYYY-MM-{UNIT_CODE}
      const invoiceNumber = `MGT-${currentMonth}-${unit.code}`
      const amount = unit.monthlyManagementFee || 0

      try {
        const invoice = await db.invoice.create({
          data: {
            invoiceNumber,
            type: "MANAGEMENT_SERVICE",
            amount,
            unitId: unit.id,
            ownerAssociationId: unit.ownerAssociation.id,
            issuedAt: today,
            totalPaid: 0,
            remainingBalance: amount,
            isPaid: false
          },
          include: {
            unit: true,
            ownerAssociation: true
          }
        })

        console.log(`[Monthly Billing] ✓ Created invoice ${invoiceNumber} for ${unit.code}`)
        invoicesCreated.push({
          invoiceNumber: invoice.invoiceNumber,
          unitCode: unit.code,
          unitName: unit.name,
          amount: invoice.amount,
          ownerName: unit.ownerAssociation.name
        })
      } catch (error) {
        console.error(`[Monthly Billing] Error creating invoice for ${unit.code}:`, error)
        skipped.push({
          unitCode: unit.code,
          unitName: unit.name,
          reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
    }

    return NextResponse.json({
      success: true,
      billingDay: currentDay,
      month: currentMonth,
      summary: {
        totalUnitsChecked: unitsToInvoice.length,
        invoicesCreated: invoicesCreated.length,
        skipped: skipped.length
      },
      invoicesCreated,
      skipped
    })
  } catch (error) {
    console.error("[Monthly Billing] Error:", error)
    return NextResponse.json(
      { 
        error: "Failed to generate monthly invoices",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check which units would be invoiced today
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin or Accountant access required" },
        { status: 403 }
      )
    }

    const today = new Date()
    const currentDay = today.getDate()

    const unitsToInvoice = await db.operationalUnit.findMany({
      where: {
        isActive: true,
        monthlyBillingDay: currentDay,
        monthlyManagementFee: {
          gt: 0
        }
      },
      include: {
        project: {
          select: {
            name: true
          }
        },
        ownerAssociation: {
          select: {
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      billingDay: currentDay,
      unitsCount: unitsToInvoice.length,
      units: unitsToInvoice.map(unit => ({
        id: unit.id,
        code: unit.code,
        name: unit.name,
        projectName: unit.project.name,
        monthlyFee: unit.monthlyManagementFee,
        billingDay: unit.monthlyBillingDay,
        ownerName: unit.ownerAssociation?.name || "No owner"
      }))
    })
  } catch (error) {
    console.error("[Monthly Billing Check] Error:", error)
    return NextResponse.json(
      { 
        error: "Failed to check billing schedule",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
