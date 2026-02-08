import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const body = await req.json()

    // Verify API key
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      )
    }

    // Only RESIDENT role can create tickets
    if (auth.context.role !== "RESIDENT") {
      await logWebhookEvent(
        auth.context.keyId,
        "TICKET_CREATED",
        "/api/webhooks/tickets",
        "POST",
        403,
        body,
        { error: "Insufficient permissions" },
        "Only residents can create tickets",
        ipAddress
      )

      return NextResponse.json(
        { error: "Only residents can create tickets" },
        { status: 403 }
      )
    }

    // Validate required fields
    const {
      residentName,
      residentEmail,
      residentPhone,
      unitCode,
      title,
      description,
      priority
    } = body

    if (!residentName || !unitCode || !title || !description) {
      await logWebhookEvent(
        auth.context.keyId,
        "TICKET_CREATED",
        "/api/webhooks/tickets",
        "POST",
        400,
        body,
        { error: "Missing required fields" },
        "Missing: residentName, unitCode, title, or description",
        ipAddress
      )

      return NextResponse.json(
        {
          error: "Missing required fields: residentName, unitCode, title, description"
        },
        { status: 400 }
      )
    }

    // Find or create resident
    let resident = await db.resident.findFirst({
      where: {
        AND: [
          { name: residentName },
          {
            unit: {
              code: unitCode
            }
          }
        ]
      },
      include: { unit: true }
    })

    if (!resident) {
      // Try to find unit
      const unit = await db.operationalUnit.findFirst({
        where: { code: unitCode }
      })

      if (!unit) {
        await logWebhookEvent(
          auth.context.keyId,
          "TICKET_CREATED",
          "/api/webhooks/tickets",
          "POST",
          404,
          body,
          { error: "Unit not found" },
          `Unit with code ${unitCode} not found`,
          ipAddress
        )

        return NextResponse.json(
          { error: `Unit with code ${unitCode} not found` },
          { status: 404 }
        )
      }

      // Create resident
      resident = await db.resident.create({
        data: {
          name: residentName,
          email: residentEmail || null,
          phone: residentPhone || null,
          unitId: unit.id,
          status: "ACTIVE"
        },
        include: { unit: true }
      })
    }

    // Update resident contact info if provided
    if (residentEmail || residentPhone) {
      resident = await db.resident.update({
        where: { id: resident.id },
        data: {
          ...(residentEmail && { email: residentEmail }),
          ...(residentPhone && { phone: residentPhone })
        },
        include: { unit: true }
      })
    }

    // Create ticket
    const ticket = await db.ticket.create({
      data: {
        title,
        description,
        priority: priority || "Normal",
        status: "NEW",
        residentId: resident!.id,
        unitId: resident!.unit.id
      }
    })

    const response = {
      success: true,
      ticketId: ticket.id,
      ticketNumber: `TICK-${ticket.id.substring(0, 8).toUpperCase()}`,
      resident: {
        id: resident!.id,
        name: resident!.name,
        email: resident!.email,
        phone: resident!.phone,
        unitCode: resident!.unit.code
      },
      message: "Ticket created successfully"
    }

    await logWebhookEvent(
      auth.context.keyId,
      "TICKET_CREATED",
      "/api/webhooks/tickets",
      "POST",
      201,
      body,
      response,
      undefined,
      ipAddress
    )

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error("Error creating ticket:", error)

    const auth = await verifyN8nApiKey(req)
    if (auth.context) {
      await logWebhookEvent(
        auth.context.keyId,
        "TICKET_CREATED",
        "/api/webhooks/tickets",
        "POST",
        500,
        undefined,
        { error: "Internal server error" },
        error instanceof Error ? error.message : "Unknown error",
        ipAddress
      )
    }

    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    )
  }
}
