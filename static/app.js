document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        });
    });

    // Audio Logic
    let mediaRecorder;
    let audioChunks = [];
    let audioBlob = null;
    let isRecording = false;
    let timerInterval;
    let seconds = 0;

    const recordBtn = document.getElementById('record-btn');
    const recordStatus = document.getElementById('record-status');
    const recordingIndicator = document.getElementById('recording-indicator');
    const timerDisplay = document.querySelector('.timer');
    
    const fileUpload = document.getElementById('file-upload');
    const dropZone = document.getElementById('drop-zone');
    const fileNameDisplay = document.getElementById('file-name');
    
    const submitBtn = document.getElementById('submit-btn');

    // Recording functionality
    recordBtn.addEventListener('click', async () => {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = e => {
                    if (e.data.size > 0) audioChunks.push(e.data);
                };

                mediaRecorder.onstop = () => {
                    audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    recordStatus.textContent = 'Recording saved. Ready to generate quote.';
                    submitBtn.disabled = false;
                    
                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                isRecording = true;
                
                // UI Updates
                recordBtn.classList.add('recording');
                recordBtn.innerHTML = '<i class="ph ph-stop"></i>';
                recordStatus.classList.add('hidden');
                recordingIndicator.classList.remove('hidden');
                
                // Timer
                seconds = 0;
                timerDisplay.textContent = '00:00';
                timerInterval = setInterval(() => {
                    seconds++;
                    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
                    const secs = (seconds % 60).toString().padStart(2, '0');
                    timerDisplay.textContent = `${mins}:${secs}`;
                }, 1000);

                // Clear any previous file
                fileUpload.value = '';
                fileNameDisplay.textContent = '';

            } catch (err) {
                console.error("Error accessing microphone:", err);
                alert("Could not access the microphone. Please check permissions.");
            }
        } else {
            mediaRecorder.stop();
            isRecording = false;
            
            // UI Updates
            recordBtn.classList.remove('recording');
            recordBtn.innerHTML = '<i class="ph ph-microphone"></i>';
            recordStatus.classList.remove('hidden');
            recordingIndicator.classList.add('hidden');
            clearInterval(timerInterval);
        }
    });

    // File Upload functionality
    fileUpload.addEventListener('change', handleFileSelect);

    // Drag and Drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if(files.length) {
            fileUpload.files = files;
            handleFileSelect();
        }
    });

    function handleFileSelect() {
        const file = fileUpload.files[0];
        if (file && file.type.startsWith('audio/')) {
            audioBlob = file;
            fileNameDisplay.textContent = `Selected: ${file.name}`;
            submitBtn.disabled = false;
            
            // Clear recording state
            recordStatus.textContent = 'Click to start recording';
        } else {
            alert('Please select a valid audio file.');
            fileUpload.value = '';
            fileNameDisplay.textContent = '';
            submitBtn.disabled = true;
        }
    }

    // Submission
    const loadingState = document.getElementById('loading-state');
    const interactionCard = document.querySelector('.interaction-card');
    const resultsSection = document.getElementById('results-section');
    const resetBtn = document.getElementById('reset-btn');

    submitBtn.addEventListener('click', async () => {
        if (!audioBlob) return;

        // UI transitions
        interactionCard.classList.add('hidden');
        loadingState.classList.remove('hidden');

        const formData = new FormData();
        // Provide a filename with a generic extension if recorded
        const filename = fileUpload.files[0]?.name || 'recording.webm';
        formData.append('audio_file', audioBlob, filename);

        try {
            const response = await fetch('/generate-quote', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Server error: ${response.status}`);
            }

            const data = await response.json();
            displayResults(data);

        } catch (error) {
            console.error('Error submitting audio:', error);
            alert(`Failed to process audio: ${error.message}`);
            
            // Reset UI
            loadingState.classList.add('hidden');
            interactionCard.classList.remove('hidden');
        }
    });

    function displayResults(data) {
        loadingState.classList.add('hidden');
        resultsSection.classList.remove('hidden');

        // Populate Transcript
        document.getElementById('transcript-text').textContent = data.transcript;

        if (data.extracted_data) {
            // Populate Customer Details
            document.getElementById('customer-details').textContent = 
                data.extracted_data.customer_details || 'No customer details extracted.';

            // Populate Items
            const tbody = document.getElementById('items-body');
            tbody.innerHTML = '';
            
            if (data.extracted_data.items && data.extracted_data.items.length > 0) {
                data.extracted_data.items.forEach(item => {
                    const tr = document.createElement('tr');
                    
                    // Format item name (remove underscores, capitalize)
                    const itemName = item.item_name.replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                    
                    tr.innerHTML = `
                        <td>${itemName}</td>
                        <td>${item.quantity}</td>
                        <td>${item.unit}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No items extracted.</td></tr>';
            }
        }
    }

    // Reset workflow
    resetBtn.addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        interactionCard.classList.remove('hidden');
        
        // Reset states
        audioBlob = null;
        fileUpload.value = '';
        fileNameDisplay.textContent = '';
        submitBtn.disabled = true;
        recordStatus.textContent = 'Click to start recording';
    });
});
