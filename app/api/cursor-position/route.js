import { NextResponse } from "next/server";
import { updateCursorPosition } from "../sse/route";

export async function POST(req) {
    try {
        const body = await req.json();
        const { documentId, userEmail, position } = body;
        
        if (!documentId || !userEmail || position === undefined) {
            return NextResponse.json({ 
                message: "Document ID, user email and position are required" 
            }, { status: 400 });
        }
        
        await updateCursorPosition(documentId, userEmail, position);
        
        return NextResponse.json({
            message: "Cursor position updated successfully"
        });
    } catch (error) {
        return NextResponse.json({
            message: "Error updating cursor position",
            error: error.message
        }, { status: 500 });
    }
}