<script lang="ts">
  import { onMount } from 'svelte';

  export let imageUrl: string;
  export let areasOfInterest: any[] = [];
  export let activeFinding: string | null = null;

  let canvas: HTMLCanvasElement;
  let image: HTMLImageElement;

  function draw() {
    if (!canvas || !image || !image.complete) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas internal resolution to match image native resolution
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (activeFinding) {
       ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
       ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    areasOfInterest.forEach(area => {
      const box = area.location_box_2d;
      if (!box || box.length !== 4) return;
      
      const [ymin, xmin, ymax, xmax] = box;
      // Convert normalized 0-1000 coordinates to actual image pixel coordinates
      const x = (xmin / 1000) * canvas.width;
      const y = (ymin / 1000) * canvas.height;
      const width = ((xmax - xmin) / 1000) * canvas.width;
      const height = ((ymax - ymin) / 1000) * canvas.height;

      const isActive = activeFinding === area.finding;
      const isDimmed = activeFinding && !isActive;

      // Clear the dimming over the specific active region
      if (isActive) {
        ctx.clearRect(x, y, width, height);
      }

      // Draw the bounding box
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.lineWidth = isActive ? 8 : 4;
      ctx.strokeStyle = isDimmed ? 'rgba(239, 68, 68, 0.3)' : '#ef4444'; // red-500
      ctx.stroke();

      // Tooltip background
      const padding = 12;
      ctx.font = isActive ? 'bold 28px sans-serif' : 'bold 20px sans-serif';
      const text = isActive && area.confidence_score 
        ? `${area.finding} (${Math.round(area.confidence_score * 100)}%)`
        : area.finding;
        
      const textWidth = ctx.measureText(text).width;
      const boxHeight = isActive ? 45 : 30;
      const textYOffset = isActive ? 32 : 22;
      
      ctx.fillStyle = isDimmed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.9)';
      ctx.fillRect(x, Math.max(0, y - boxHeight), textWidth + (padding * 2), boxHeight);
      
      ctx.fillStyle = isDimmed ? 'rgba(255, 255, 255, 0.5)' : 'white';
      ctx.fillText(text, x + padding, Math.max(0, y - boxHeight) + textYOffset);

      // Draw clinical significance badge if active
      if (isActive && area.clinical_significance) {
        ctx.font = 'bold 16px sans-serif';
        const sigWidth = ctx.measureText(area.clinical_significance).width;
        ctx.fillStyle = area.clinical_significance === 'CRITICAL' ? '#991b1b' : '#b45309';
        ctx.fillRect(x, y + height, sigWidth + (padding * 2), 25);
        ctx.fillStyle = 'white';
        ctx.fillText(area.clinical_significance, x + padding, y + height + 18);
      }
    });
  }

  // Svelte 5 $effect for reactivity
  $effect(() => {
    if (activeFinding !== undefined || areasOfInterest) {
      draw();
    }
  });

  onMount(() => {
    image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      draw();
    };
    image.src = imageUrl;
  });
</script>

<div class="relative inline-block max-w-full group">
  <!-- Native Image for layout sizing -->
  <img src={imageUrl} alt="Radiograph Analysis" class="max-h-[600px] w-auto h-auto object-contain block transition-opacity duration-300" />
  
  <!-- Overlay Canvas -->
  <canvas 
    bind:this={canvas} 
    class="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300"
  ></canvas>
</div>
