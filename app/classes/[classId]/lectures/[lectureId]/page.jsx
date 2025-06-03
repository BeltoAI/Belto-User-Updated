import { notFound } from 'next/navigation';
import LectureDetailsClient from '@/app/components/LectureDetailsClient';

async function getLectureDetails(classId, lectureId) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/classes/${classId}/lectures/${lectureId}`,
      {
        next: { revalidate: 60 },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch lecture details');
    }

    return response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

export default async function LecturePage({ params }) {
  try {
    const lecture = await getLectureDetails(params.classId, params.lectureId);

    return (
      <LectureDetailsClient 
        initialLecture={lecture}
        classId={params.classId}
        lectureId={params.lectureId}
      />
    );
  } catch (error) {
    notFound();
  }
}
