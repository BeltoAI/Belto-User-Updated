"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import AIPreferencesConfig from './AIPreferencesConfig';

const LectureDetailsClient = ({ 
  initialLecture, 
  classId, 
  lectureId 
}) => {
  const [user, setUser] = useState(null);
  const [classData, setClassData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfessor, setIsProfessor] = useState(false);

  useEffect(() => {
    const fetchUserAndClassData = async () => {
      try {
        // Get current user
        const userResponse = await fetch('/api/auth/user');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData);

          // Get class data to check if user is professor
          const classResponse = await fetch(`/api/classes/${classId}`);
          if (classResponse.ok) {
            const classInfo = await classResponse.json();
            setClassData(classInfo);
            
            // Check if current user is the professor for this class
            const professorStatus = classInfo.professorId === userData._id;
            setIsProfessor(professorStatus);
          }
        }
      } catch (error) {
        console.error('Error fetching user/class data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserAndClassData();
  }, [classId]);

  const handleAIPreferencesUpdate = (updatedPreferences) => {
    // Handle AI preferences update if needed
    console.log('AI preferences updated:', updatedPreferences);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto p-6">
        <Link 
          href={`/mainsection`}
          className="inline-flex items-center mb-6 text-white hover:text-yellow-500 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Class
        </Link>

        <div className="bg-black rounded-lg border border-yellow-500 p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {initialLecture.title}
            </h1>
            <div className="flex items-center gap-x-4 text-sm mt-2">
              <div className="flex items-center gap-x-1 text-white">
                <Calendar className="h-4 w-4 text-yellow-500" />
                <span>
                  {new Date(initialLecture.startDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-x-1 text-white">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span>
                  {new Date(initialLecture.endDate).getHours() - new Date(initialLecture.startDate).getHours()} hour(s)
                </span>
              </div>
            </div>
          </div>

          <div className="bg-black rounded-lg border border-yellow-500/20 p-4 mb-8">
            <h2 className="text-xl font-semibold mb-2 text-white">
              About this lecture
            </h2>
            <p className="text-sm text-white leading-6">
              {initialLecture.description}
            </p>
          </div>

          <div className='flex flex-col gap-4 mb-8'>
            <h2 className='text-xl font-semibold text-white'>
              Materials
            </h2>
            <div className='bg-black rounded-lg border border-yellow-500/20 p-4'>
              {initialLecture.materials.length === 0 ? (
                <p className='text-white text-sm'>
                  No materials available
                </p>
              ) : (
                initialLecture.materials.map((material) => (
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

          {/* AI Preferences Section - Only visible to professors */}
          {isProfessor && (
            <div className='flex flex-col gap-4'>
              <h2 className='text-xl font-semibold text-white'>
                AI Configuration
              </h2>
              <div className='bg-black rounded-lg border border-yellow-500/20 p-4'>
                <AIPreferencesConfig 
                  lectureId={lectureId} 
                  onUpdate={handleAIPreferencesUpdate}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LectureDetailsClient;
