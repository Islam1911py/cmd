import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const { id } = await params
    const body = await req.json()

    // Verify API key
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      )
    }

    // Only ADMIN or PROJECT_MANAGER can update tickets
    if (
      auth.context.role !== "ADMIN" &&
      auth.context.role !== "PROJECT_MANAGER"
    ) {
      await logWebhookEvent(
        auth.context.keyId,
        "TICKET_UPDATED",
        `/api/webhooks/tickets/${id}`,
        "PUT",
        403,
        body,
        { error: "Insufficient permissions" },
        "Only ADMIN or PROJECT_MANAGER can update tickets",
        ipAddress
      )

      return NextResponse.json(
        { error: "Insufficient permissions to update tickets" },
        { status: 403 }
      )
    }

    // Find ticket
    const ticket = await db.ticket.findUnique({
      where: { id },
      include: {
        resident: true,
        unit: true
      }
    })

    if (!ticket) {
      await logWebhookEvent(
        auth.context.keyId,
        "TICKET_UPDATED",
        `/api/webhooks/tickets/${id}`,
        "PUT",
        404,
        body,
        { error: "Ticket not found" },
        undefined,
        ipAddress
      )

      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      )
    }

    const { status, notes, resolution, assignedToId } = body

    // Update ticket
    const updatedTicket = await db.ticket.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes && { description: notes }),
        ...(resolution && { resolution }),
        ...(assignedToId && { assignedToId }),
        ...(status === "DONE" && { closedAt: new Date() })
      },
      include: {
        resident: true,
        unit: true,
        assignedTo: true
      }
    })

    // Prepare callback response for n8n
    const n8nCallback = {
      event: status === "DONE" ? "TICKET_RESOLVED" : "TICKET_UPDATED",
      ticketId: updatedTicket.id,
      ticketNumber: `TICK-${updatedTicket.id.substring(0, 8).toUpperCase()}`,
      status: updatedTicket.status,
      resident: {
        id: updatedTicket.resident.id,
        name: updatedTicket.resident.name,
        email: updatedTicket.resident.email,
        phone: updatedTicket.resident.phone
      },
      unit: {
        code: updatedTicket.unit.code,
        name: updatedTicket.unit.name
      },
      title: updatedTicket.title,
      description: updatedTicket.description,
      resolution: updatedTicket.resolution,
      assignedTo: updatedTicket.assignedTo ? {
        id: updatedTicket.assignedTo.id,
        name: updatedTicket.assignedTo.name
      } : null,
      updatedAt: updatedTicket.updatedAt,
      closedAt: updatedTicket.closedAt
    }

    const response = {
      success: true,
      ticket: updatedTicket,
      n8nCallback: n8nCallback,
      message: "Ticket updated successfully"
    }

    await logWebhookEvent(
      auth.context.keyId,
      status === "DONE" ? "TICKET_RESOLVED" : "TICKET_UPDATED",
      `/api/webhooks/tickets/${id}`,
      "PUT",
      200,
      body,
      response,
      undefined,
      ipAddress
    )

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error updating ticket:", error)

    const auth = await verifyN8nApiKey(req)
    if (auth.context) {
      const { id } = await params
      await logWebhookEvent(
        auth.context.keyId,
        "TICKET_UPDATED",
        `/api/webhooks/tickets/${id}`,
        "PUT",
        500,
        undefined,
        { error: "Internal server error" },
        error instanceof Error ? error.message : "Unknown error",
        ipAddress
      )
    }

    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 }
    )
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify API key
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      )
    }

    // Find ticket
    const ticket = await db.ticket.findUnique({
      where: { id },
      include: {
        resident: true,
        unit: true,
        assignedTo: true
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      ticket: ticket
    })
  } catch (error) {
    console.error("Error fetching ticket:", error)

    return NextResponse.json(
      { error: "Failed to fetch ticket" },
      { status: 500 }
    )
  }
}
