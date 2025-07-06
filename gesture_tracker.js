class HandGestureTracker {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.status = document.getElementById('status');
        
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.toggleLandmarksBtn = document.getElementById('toggleLandmarks');
        
        this.showLandmarks = true;
        this.isTracking = false;
        this.stream = null;
        this.animationId = null;
        
        this.gestureCounts = {
            thumbsUp: 0,
            peace: 0,
            fist: 0,
            openHand: 0
        };
        
        this.currentGesture = null;
        this.gestureStartTime = 0;
        this.gestureThreshold = 1000; // 1 second to confirm gesture
        
        this.initializeEventListeners();
        this.initializeHandTracking();
    }
    
    initializeEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
        this.toggleLandmarksBtn.addEventListener('click', () => this.toggleLandmarks());
    }
    
    async initializeHandTracking() {
        if (typeof Hands !== 'undefined') {
            this.hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });
            
            this.hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });
            
            this.hands.onResults((results) => this.onResults(results));
            this.status.textContent = 'MediaPipe Hands ready. Click "Start Camera" to begin.';
        } else {
            this.status.textContent = 'Loading MediaPipe... Please wait.';
            setTimeout(() => this.initializeHandTracking(), 1000);
        }
    }
    
    async startCamera() {
        console.log("trying to start the camera");
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 } 
            });
            this.video.srcObject = this.stream;
            this.video.play();
            
            this.video.addEventListener('loadedmetadata', () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                this.startTracking();
            });
            
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.status.textContent = 'Camera started. Show your hands to the camera!';
        } catch (err) {
            this.status.textContent = 'Error accessing camera: ' + err.message;
            console.error('Error accessing camera:', err);
        }
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.isTracking = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.status.textContent = 'Camera stopped. Click "Start Camera" to begin again.';
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    toggleLandmarks() {
        this.showLandmarks = !this.showLandmarks;
        this.toggleLandmarksBtn.textContent = this.showLandmarks ? 'Hide Landmarks' : 'Show Landmarks';
    }
    
    startTracking() {
        this.isTracking = true;
        this.trackFrame();
    }
    
    async trackFrame() {
        if (!this.isTracking) return;
        
        if (this.hands && this.video.readyState === 4) {
            await this.hands.send({ image: this.video });
        }
        
        this.animationId = requestAnimationFrame(() => this.trackFrame());
    }
    
    onResults(results) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                if (this.showLandmarks) {
                    this.drawLandmarks(landmarks);
                }
                
                const gesture = this.recognizeGesture(landmarks);
                this.handleGestureDetection(gesture);
            }
        }
    }
    
    drawLandmarks(landmarks) {
        // Draw connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // index
            [0, 9], [9, 10], [10, 11], [11, 12], // middle
            [0, 13], [13, 14], [14, 15], [15, 16], // ring
            [0, 17], [17, 18], [18, 19], [19, 20], // pinky
            [5, 9], [9, 13], [13, 17] // palm
        ];
        
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        
        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            
            this.ctx.beginPath();
            this.ctx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
            this.ctx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
            this.ctx.stroke();
        });
        
        // Draw landmarks
        this.ctx.fillStyle = '#ff0000';
        landmarks.forEach(landmark => {
            this.ctx.beginPath();
            this.ctx.arc(
                landmark.x * this.canvas.width,
                landmark.y * this.canvas.height,
                5, 0, 2 * Math.PI
            );
            this.ctx.fill();
        });
    }
    
    recognizeGesture(landmarks) {
        // Simple gesture recognition based on finger positions
        const fingerTips = [4, 8, 12, 16, 20]; // thumb, index, middle, ring, pinky
        const fingerMCPs = [2, 5, 9, 13, 17]; // metacarpophalangeal joints
        
        const fingersUp = fingerTips.map((tip, index) => {
            if (index === 0) { // thumb
                return landmarks[tip].x > landmarks[fingerMCPs[index]].x;
            } else {
                return landmarks[tip].y < landmarks[fingerMCPs[index]].y;
            }
        });
        
        const upCount = fingersUp.filter(Boolean).length;
        
        // Gesture recognition logic
        if (upCount === 1 && fingersUp[0]) {
            return 'thumbsUp';
        } else if (upCount === 2 && fingersUp[1] && fingersUp[2]) {
            return 'peace';
        } else if (upCount === 0) {
            return 'fist';
        } else if (upCount === 5) {
            return 'openHand';
        }
        
        return null;
    }
    
    handleGestureDetection(gesture) {
        const currentTime = Date.now();
        
        if (gesture === this.currentGesture) {
            // Same gesture detected, check if we've held it long enough
            if (currentTime - this.gestureStartTime >= this.gestureThreshold) {
                this.confirmGesture(gesture);
                this.gestureStartTime = currentTime; // Reset timer for next detection
            }
        } else {
            // New gesture or no gesture
            this.currentGesture = gesture;
            this.gestureStartTime = currentTime;
            this.clearGestureHighlights();
        }
    }
    
    confirmGesture(gesture) {
        if (gesture && this.gestureCounts.hasOwnProperty(gesture)) {
            this.gestureCounts[gesture]++;
            this.updateGestureDisplay(gesture);
            this.highlightGestureCard(gesture);
        }
    }
    
    updateGestureDisplay(gesture) {
        const countElement = document.getElementById(gesture + 'Count');
        if (countElement) {
            countElement.textContent = this.gestureCounts[gesture];
        }
    }
    
    highlightGestureCard(gesture) {
        const card = document.getElementById(gesture);
        if (card) {
            card.classList.add('detected-gesture');
            setTimeout(() => {
                card.classList.remove('detected-gesture');
            }, 1000);
        }
    }
    
    clearGestureHighlights() {
        document.querySelectorAll('.gesture-card').forEach(card => {
            card.classList.remove('detected-gesture');
        });
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new HandGestureTracker();
});