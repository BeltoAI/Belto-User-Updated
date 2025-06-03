import connectDB from '@/lib/db';
import { NextResponse } from 'next/server';
import Lecture from '@/models/Lecture';
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const lectureId = searchParams.get('lectureId');

        if (!lectureId) {
            return NextResponse.json({ error: 'Lecture ID is required' }, { status: 400 });
        }

        await connectDB();

        const lecture = await Lecture.findById(lectureId);

        if (!lecture) {
            return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
        }

        return NextResponse.json({ materials: lecture.materials });
    } catch (error) {
        console.error('Error processing lecture materials request:', error);
        return NextResponse.json({
            error: 'Failed to fetch lecture materials',
            details: error.message
        }, { status: 500 });
    }
}