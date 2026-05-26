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

    let audioContext;
    let analyser;
    let dataArray;

    const recordBtn = document.getElementById('record-btn');
    const recordStatus = document.getElementById('record-status');
    const recordingIndicator = document.getElementById('recording-indicator');
    const timerDisplay = document.querySelector('.timer');
    
    const canvas = document.getElementById('eq-canvas');
    const ctx = canvas.getContext('2d');
    
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
                
                // Set up Web Audio API for Equalizer
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                } else if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
                
                const source = audioContext.createMediaStreamSource(stream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                
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

            // Populate Quote Status
            const quoteStatusEl = document.getElementById('quote-status');
            if (quoteStatusEl) {
                const actionType = data.extracted_data.action_type;
                if (actionType === 'generate') {
                    quoteStatusEl.innerHTML = '<strong>Final Quote Generated</strong>';
                    quoteStatusEl.style.color = '#10b981'; // green
                } else {
                    quoteStatusEl.innerHTML = '<strong>Draft</strong>';
                    quoteStatusEl.style.color = '#f59e0b'; // orange
                }
            }

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
                if (data.extracted_data.action_type === 'generate') {
                    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem; color: #10b981;"><strong>Final Quote Generated!</strong><br><small style="color: var(--text-secondary);">Your quote has been finalized.</small></td></tr>';
                } else {
                    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No items extracted.</td></tr>';
                }
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

    // Blob Equalizer Drawing Loop
    let idleAngle = 0;
    const numRings = 14;
    const numPoints = 24; // Lower number of points for smoother, larger curves
    let history = [];
    
    // Initialize history
    for (let i = 0; i < numRings; i++) {
        history.push(new Array(numPoints).fill(0));
    }
    
    function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const baseInnerRadius = 25;
        const ringSpacing = 7;
        
        let currentFrame = new Array(numPoints).fill(0);
        
        if (isRecording && analyser && dataArray) {
            analyser.getByteFrequencyData(dataArray);
            const halfPoints = numPoints / 2;
            for (let i = 0; i < numPoints; i++) {
                let dataIndex = i;
                if (i >= halfPoints) {
                    dataIndex = numPoints - 1 - i; // mirror for symmetry
                }
                
                // Map to the first ~24 bins (bass & vocal ranges)
                let actualIndex = Math.floor((dataIndex / halfPoints) * 24);
                currentFrame[i] = dataArray[actualIndex];
            }
        } else {
            // Idle organic blob animation
            for (let i = 0; i < numPoints; i++) {
                const angle = i * (Math.PI * 2) / numPoints;
                const wave = Math.sin(angle * 2 + idleAngle) * 12 + 
                             Math.cos(angle * 3 - idleAngle * 0.8) * 8;
                currentFrame[i] = 30 + wave;
            }
        }
        
        idleAngle += 0.02;
        
        // Push new data and remove oldest
        history.unshift(currentFrame);
        history.pop();
        
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        
        // Draw from outside-in (oldest history first)
        for (let r = numRings - 1; r >= 0; r--) {
            const frameData = history[r];
            const baseRadius = baseInnerRadius + (r * ringSpacing);
            
            let color;
            if (r < numRings * 0.3) {
                color = '#ced7e0'; // inner brightest
            } else if (r < numRings * 0.7) {
                color = '#9ccddc'; // mid
            } else {
                color = '#5591a9'; // outer dark teal
            }
            
            ctx.strokeStyle = color;
            ctx.shadowBlur = 6;
            ctx.shadowColor = color;
            
            // Calculate points for this ring
            const points = [];
            for (let i = 0; i < numPoints; i++) {
                const value = frameData[i];
                // Smooth perturbation that scales down for outer rings
                const perturbation = (value / 255) * 45 * (1 - r/(numRings * 1.5));
                const radius = baseRadius + Math.max(0, perturbation);
                
                const angle = i * (Math.PI * 2) / numPoints - Math.PI / 2;
                points.push({
                    x: cx + Math.cos(angle) * radius,
                    y: cy + Math.sin(angle) * radius
                });
            }
            
            // Draw smooth closed shape using quadratic curves
            ctx.beginPath();
            const startX = (points[0].x + points[numPoints-1].x) / 2;
            const startY = (points[0].y + points[numPoints-1].y) / 2;
            ctx.moveTo(startX, startY);
            
            for (let i = 0; i < numPoints; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % numPoints];
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
            }
            
            ctx.closePath();
            ctx.stroke();
        }
    }
    
    drawVisualizer();
});
