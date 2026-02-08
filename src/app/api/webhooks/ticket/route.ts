import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readSignedJson } from "@/lib/webhook-signature"
import { buildPhoneVariants } from "@/lib/phone"

// POST /api/webhooks/ticket - Create ticket from WhatsApp (n8n webhook)
export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET
    const { body } = await readSignedJson(req, webhookSecret)

    const residentPhone = body.residentPhone || body.senderPhone || body.from
    const unitCode = body.unitCode || body.unit
    const description = body.description || body.text || body.message
    const projectId = body.projectId
    const priority = body.priority || "Normal"

    // Validate required fields
    if (!residentPhone || !unitCode || !description || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: residentPhone, unitCode, description, projectId" },
        { status: 400 }
      )
    }

    // Find unit by code and project
    const unit = await db.operationalUnit.findFirst({
      where: {
        code: unitCode,
        projectId: projectId
      }
    })

    if (!unit) {
      return NextResponse.json(
        { error: "Unit not found for the given code and project" },
        { status: 404 }
      )
    }

    // Find resident by phone in this unit
    const phoneVariants = buildPhoneVariants(residentPhone)
    const resident = await db.resident.findFirst({
      where: {
        unitId: unit.id,
        OR: [
          { phone: { in: phoneVariants } },
          { whatsappPhone: { in: phoneVariants } }
        ]
      },
      include: {
        unit: {
          include: {
            project: true
          }
        }
      }
    })

    if (!resident) {
      return NextResponse.json(
        { error: "Resident not found for the given phone in this unit" },
        { status: 404 }
      )
    }

    // Create ticket
    const ticket = await db.ticket.create({
      data: {
        title: description.substring(0, 100),
        description,
        status: "NEW",
        priority,
        residentId: resident.id,
        unitId: resident.unitId
      },
      include: {
        resident: true,
        unit: {
          include: {
            project: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    const whatsappMessage = `شكوى جديدة من الساكن ${resident.name}\nفي المشروع ${ticket.unit.project.name}\nالوحدة ${ticket.unit.name}\nالشكوى\n${ticket.description}`

    return NextResponse.json(
      {
        success: true,
        ticketId: ticket.id,
        message: "Ticket created successfully",
        whatsappMessage,
        ticket
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_SIGNATURE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error processing ticket webhook:", error)
    
    // Log error
    try {
      await db.webhookLog.create({
        data: {
          source: "WhatsApp",
          eventType: "Ticket",
          payload: null,
          status: "error",
          response: error instanceof Error ? error.message : "Unknown error"
        }
      })
    } catch (logError) {
      console.error("Error logging webhook:", logError)
    }
    
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    )
  }
}
