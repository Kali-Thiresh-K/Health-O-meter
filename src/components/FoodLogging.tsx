import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Clock, Utensils, Camera, Upload, X, Loader2 } from 'lucide-react';
import { useFoodLogs } from '@/hooks/useFoodLogs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { VoiceRecognition } from './VoiceRecognition';

export function FoodLogging() {
  const [foodInput, setFoodInput] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<'morning' | 'afternoon' | 'evening' | null>(null);
  const [showImageCapture, setShowImageCapture] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [pendingFood, setPendingFood] = useState<{ name: string; mealType: 'morning' | 'afternoon' | 'evening' | null } | null>(null);
  const [quantityInput, setQuantityInput] = useState('1 serving');
  const videoRef = useRef<HTMLVideoElement>(null);
  const { logFood, getCurrentMealType, hasPeriodLogs } = useFoodLogs();

  // Gemini API key
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

  // Cleanup camera stream on component unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const getCurrentHour = () => new Date().getHours();

  const isMealTimeActive = (meal: 'morning' | 'afternoon' | 'evening') => {
    const hour = getCurrentHour();
    const hasLogged = hasPeriodLogs(meal);

    switch (meal) {
      case 'morning':
        return hour >= 6 && hour < 12 && !hasLogged;
      case 'afternoon':
        return hour >= 12 && hour < 17 && !hasLogged;
      case 'evening':
        return hour >= 17 && !hasLogged;
      default:
        return false;
    }
  };

  const getMealEmoji = (meal: 'morning' | 'afternoon' | 'evening') => {
    switch (meal) {
      case 'morning': return '🌅';
      case 'afternoon': return '☀️';
      case 'evening': return '🌙';
    }
  };

  const getMealStatus = (meal: 'morning' | 'afternoon' | 'evening') => {
    const hasLogged = hasPeriodLogs(meal);
    const isActive = isMealTimeActive(meal);

    if (hasLogged) return { text: 'Logged ✅', variant: 'default' as const };
    if (isActive) return { text: 'Log Now! ⚡', variant: 'default' as const };
    return { text: 'Not Time Yet ⏰', variant: 'secondary' as const };
  };

  const handleVoiceResult = (result: { transcript: string; mealType: 'morning' | 'afternoon' | 'evening' | null }) => {
    setIsListening(false);
    setPendingFood({ name: result.transcript, mealType: result.mealType });
    setQuantityInput('1 serving');
  };

  const handleLogFood = async () => {
    if (!foodInput.trim()) {
      return;
    }

    const mealType = selectedMeal || getCurrentMealType();
    const result = await logFood(foodInput.trim(), mealType);

    if (result?.success) {
      setFoodInput('');
      setSelectedMeal(null);
      setSelectedImage(null);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large! Please select an image under 10MB 📁");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
        analyzeFoodImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      toast.error("⚠️ Please select a valid image file (PNG, JPG, GIF)");
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStream(mediaStream);
      setShowImageCapture(true);
      toast.success("📹 Camera ready! Position your food and capture");
    } catch (error) {
      toast.error("❌ Camera access denied. Please use file upload instead.");
    }
  };

  const captureImage = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setSelectedImage(imageData);
      setShowImageCapture(false);

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      analyzeFoodImage(imageData);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowImageCapture(false);
  };

  const analyzeFoodImage = async (imageData: string) => {
    setIsAnalyzing(true);

    const base64Image = imageData.split(',')[1];
    const mimeType = imageData.split(';')[0].split(':')[1];

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Identify the food items in this image and list only the food names separated by commas. 
    Be specific about the food items you can see. For example: "rice, chicken curry, naan bread" or "apple, banana, yogurt".
    Only return the food names, nothing else. If you cannot identify any food, return "unknown food item".`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType, data: base64Image } }
        ]
      }]
    };

    try {
      toast.loading("🤖 Identifying food items...", { id: "food-analysis" });

      let response: Response | null = null;
      let responseData: any = null;
      let retries = 3;
      let delay = 2000;

      for (let i = 0; i < retries; i++) {
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          responseData = await response.json();
          
          if (response.status === 429) {
            console.warn(`Rate limited (429). Retrying in ${delay}ms...`);
            if (i < retries - 1) {
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
              continue;
            }
          }
          break;
        } catch (fetchErr) {
          if (i === retries - 1) throw fetchErr;
          console.warn(`Fetch error. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        }
      }

      if (!response || !response.ok) {
        throw new Error(responseData?.error?.message || `HTTP error: ${response?.status}`);
      }

      const candidate = responseData.candidates?.[0];
      if (candidate?.content?.parts?.[0]?.text) {
        const foodNames = candidate.content.parts[0].text.trim();
        setPendingFood({ name: foodNames, mealType: selectedMeal });
        setQuantityInput('1 serving');
        toast.success("🎉 Food identified! How much did you have?", { id: "food-analysis" });
      } else {
        throw new Error("Could not identify food items");
      }
    } catch (error: any) {
      console.error("Error analyzing food:", error);
      toast.error("❌ Could not identify food. Please type manually.", { id: "food-analysis" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const confirmPendingFood = async () => {
    if (!pendingFood || !quantityInput.trim()) return;

    const finalFoodName = `${quantityInput.trim()} of ${pendingFood.name}`;
    const mealType = pendingFood.mealType || selectedMeal || getCurrentMealType();

    const result = await logFood(finalFoodName, mealType);

    if (result?.success) {
      setPendingFood(null);
      setQuantityInput('1 serving');
      setFoodInput('');
      setSelectedImage(null);
      setSelectedMeal(null);
    }
  };

  const resetImageCapture = () => {
    setSelectedImage(null);
    setShowImageCapture(false);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    const fileInput = document.getElementById('food-image-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const meals: Array<'morning' | 'afternoon' | 'evening'> = ['morning', 'afternoon', 'evening'];

  return (
    <Card id="food-logging-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Utensils className="w-5 h-5" />
          Log Your Food 🍽️
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          ✨ Buttons adapt to time of day! Log food to see your health impact.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Meal Time Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {meals.map((meal) => {
            const isActive = isMealTimeActive(meal);
            const status = getMealStatus(meal);

            return (
              <Button
                key={meal}
                variant={selectedMeal === meal ? 'default' : isActive ? 'outline' : 'secondary'}
                size="sm"
                disabled={!isActive && !selectedMeal}
                onClick={() => setSelectedMeal(selectedMeal === meal ? null : meal)}
                className={cn(
                  "flex flex-col h-auto p-3 gap-1",
                  isActive && "ring-2 ring-primary/50 animate-pulse"
                )}
              >
                <div className="flex items-center gap-1">
                  <span className="text-lg">{getMealEmoji(meal)}</span>
                  <span className="text-xs font-medium capitalize">{meal}</span>
                </div>
                <Badge variant={status.variant} className="text-xs px-1 py-0 h-4">
                  {status.text}
                </Badge>
              </Button>
            );
          })}
        </div>

        {/* Food Input with Image Capture */}
        <div className="space-y-3">
          {/* Image Capture Interface */}
          {showImageCapture && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="relative">
                <video
                  ref={(video) => {
                    videoRef.current = video;
                    if (video && stream) {
                      video.srcObject = stream;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-32 object-cover rounded-lg bg-black"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <Button onClick={captureImage} size="sm" className="flex-1">
                  <Camera className="w-4 h-4 mr-2" />
                  Capture
                </Button>
                <Button onClick={stopCamera} variant="outline" size="sm">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Selected Image Preview */}
          {selectedImage && !showImageCapture && (
            <div className="border rounded-lg p-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <img
                  src={selectedImage}
                  alt="Food"
                  className="w-16 h-16 object-cover rounded border"
                />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    {isAnalyzing ? "🤖 Analyzing food..." : "📸 Food image captured"}
                  </p>
                </div>
                <Button
                  onClick={resetImageCapture}
                  variant="ghost"
                  size="sm"
                  disabled={isAnalyzing}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Food Input Row */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                placeholder="🍎 Enter food name, use voice, or capture image..."
                value={foodInput}
                onChange={(e) => setFoodInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogFood()}
                className="pr-28"
                disabled={isAnalyzing || isListening}
              />

              {/* Voice Recognition and Image Capture Buttons */}
              <div className="absolute right-1 top-1 flex items-center gap-1">
                <VoiceRecognition
                  onResult={handleVoiceResult}
                  isListening={isListening}
                  setIsListening={setIsListening}
                  disabled={isAnalyzing}
                />

                <input
                  type="file"
                  id="food-image-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isAnalyzing}
                />
                <label htmlFor="food-image-upload">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={isAnalyzing || isListening}
                    asChild
                  >
                    <span>
                      {isAnalyzing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </span>
                  </Button>
                </label>

                <Button
                  onClick={startCamera}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={isAnalyzing || showImageCapture || isListening}
                >
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Button
              onClick={handleLogFood}
              disabled={!foodInput.trim() || isAnalyzing || isListening}
              size="sm"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Current Time Indicator */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>
            Current time: {new Date().toLocaleTimeString()} •
            Active meal: {getMealEmoji(getCurrentMealType())} {getCurrentMealType()}
          </span>
        </div>

        {/* Tips */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          💡 <strong>Pro tip:</strong> Use voice (🎤), camera (📷), or type manually! Morning button works 6AM-12PM, Afternoon 12PM-5PM, Evening after 5PM.
          Buttons turn off after logging! You can always override by selecting a different meal time.
        </div>
      </CardContent>

      <Dialog open={!!pendingFood} onOpenChange={(open) => !open && setPendingFood(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Almost there!</DialogTitle>
            <DialogDescription>
              We recognized: <strong className="text-foreground">{pendingFood?.name}</strong>.
              How much did you have? Let's add the quantity to make your log perfect!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              placeholder="e.g. 1 bowl, 2 pieces, 200g..."
              onKeyPress={(e) => e.key === 'Enter' && confirmPendingFood()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-2">
              Preview: {quantityInput.trim() ? `${quantityInput.trim()} of ${pendingFood?.name}` : pendingFood?.name}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingFood(null)}>Cancel</Button>
            <Button onClick={confirmPendingFood} disabled={!quantityInput.trim()}>Log Food</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}