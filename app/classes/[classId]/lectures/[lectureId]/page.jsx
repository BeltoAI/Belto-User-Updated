import { notFound } from 'next/navigation';
import { Calendar, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";

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
      <div className="min-h-screen bg-black">
        {/* ...existing code... */}
        <div className="max-w-4xl mx-auto p-6">
          <Link 
            href={`/mainsection`}
            className="inline-flex items-center mb-6 text-white hover:text-yellow-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Class
          </Link>

          <div className="bg-black rounded-lg border border-yellow-500 p-6">
            {/* ...existing code... */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {lecture.title}
              </h1>
              <div className="flex items-center gap-x-4 text-sm mt-2">
                <div className="flex items-center gap-x-1 text-white">
                  <Calendar className="h-4 w-4 text-yellow-500" />
                  <span>
                    {new Date(lecture.startDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-x-1 text-white">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span>
                    {new Date(lecture.endDate).getHours() - new Date(lecture.startDate).getHours()} hour(s)
                  </span>
                </div>
              </div>
            </div>

            {/* ...existing code... */}
            <div className="bg-black rounded-lg border border-yellow-500/20 p-4">
              <h2 className="text-xl font-semibold mb-2 text-white">
                About this lecture
              </h2>
              <p className="text-sm text-white leading-6">
                {lecture.description}
              </p>
            </div>

            <div className='flex flex-col gap-4 mt-8'>
              <h2 className='text-xl font-semibold text-white'>
                Materials
              </h2>
              <div className='bg-black rounded-lg border border-yellow-500/20 p-4'>
                {lecture.materials.length === 0 ? (
                  <p className='text-white text-sm'>
                    No materials available
                  </p>
                ) : (
                  lecture.materials.map((material) => (
                    <div
                      key={material._id}
                      className='flex items-center gap-x-4'
                    >
                      <div className='flex items-center gap-x-2'>
                        <a
                          href={material.url}
                          className='text-yellow-500 hover:text-yellow-400'
                        >
                          {material.title}
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    notFound();
  }
}
