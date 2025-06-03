# Professor Material Upload Test Guide

## **IMPORTANT DISCOVERY**
No separate "belto-admin" interface exists in the codebase. Professor material upload happens through the standard lecture management interface.

## **Actual Workflow Testing**

### **Step 1: Professor Material Upload**
1. Navigate to: `https://belto.vercel.app/classes/[classId]/lectures/[lectureId]`
2. Log in as a professor
3. Look for material upload functionality on the lecture details page
4. Upload materials (PDFs, DOCX, text files)
5. Verify materials appear in the materials list with:
   - Title
   - File type
   - Download links

### **Step 2: Material Processing for RAG**
1. Navigate to chat interface: `https://belto.vercel.app/chat`
2. Select the lecture that has uploaded materials
3. Look for "LectureMaterials" component in chat sidebar
4. Click "Process All Materials" button
5. Monitor processing status:
   - Yellow dots = Not processed
   - Green dots = Processed for AI search
   - Progress bar showing completion percentage

### **Step 3: Student Access & AI Enhancement**
1. Log in as a student
2. Navigate to chat for the same lecture
3. Ask questions about lecture materials:
   - "What are the key concepts in the lecture?"
   - "Explain the theory from the uploaded PDF"
   - "Summarize the main points from the materials"
4. Verify AI responses include:
   - Relevant material excerpts
   - Source attribution
   - Context from processed materials

## **Key Files for Professor Material Management**

### **Frontend**
- `app/classes/[classId]/lectures/[lectureId]/page.jsx` - Lecture details page where professors manage materials
- `app/components/LectureDetails.jsx` - Component displaying lecture materials

### **Backend**
- `app/api/classes/[classId]/lectures/[id]/route.js` - API for lecture details
- `models/Lecture.js` - Database model storing materials array
- `app/api/classes/professor-settings/route.js` - Professor settings management

### **RAG Integration**
- `app/api/lectures/[lectureId]/materials/process/route.js` - Material processing API
- `app/api/lectures/[lectureId]/materials/search/route.js` - Semantic search API
- `app/chat/components/LectureMaterials.jsx` - Material processing UI in chat

## **Testing Checklist**

- [ ] Professor can upload materials through lecture details page
- [ ] Materials appear correctly in lecture materials list
- [ ] Processing button appears in chat interface
- [ ] Materials can be processed for RAG (yellow → green dots)
- [ ] Students can ask questions about materials
- [ ] AI responses include relevant material context
- [ ] Source attribution shows which materials were used

## **Expected Behavior**

1. **Upload**: Professor uploads through `/classes/[classId]/lectures/[lectureId]`
2. **Storage**: Materials stored in `lecture.materials` array
3. **Processing**: Anyone can trigger processing via chat interface
4. **Enhancement**: Student questions automatically trigger semantic search
5. **Response**: AI includes relevant material excerpts with sources

## **Next Steps**

1. Test the professor upload workflow through the lecture details page
2. Verify materials appear correctly for students in chat
3. Confirm the complete RAG pipeline works end-to-end
4. Document any issues found in the actual workflow
