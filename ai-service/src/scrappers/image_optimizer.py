import os
from PIL import Image, ImageOps
from logging_config import get_logger

logger = get_logger(__name__)


def optimize_image(input_path: str, output_path: str = None, max_size: tuple = (1000, 1000), quality: int = 85) -> str:
    """
    Optimize image to reduce file size while maintaining quality.
    
    Args:
        input_path: Path to the input image
        output_path: Path for the optimized image (optional, defaults to input_path with _optimized suffix)
        max_size: Maximum dimensions as (width, height) tuple (default: 1000x1000)
        quality: JPEG quality (1-100, default: 85)
        
    Returns:
        Path to the optimized image
        
    Raises:
        FileNotFoundError: If input image doesn't exist
        ValueError: If quality is not between 1-100
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input image not found: {input_path}")
    
    if not 1 <= quality <= 100:
        raise ValueError("Quality must be between 1 and 100")
    
    # Generate output path if not provided
    if output_path is None:
        name, ext = os.path.splitext(input_path)
        output_path = f"{name}_optimized{ext}"
    
    logger.info(f"Optimizing image: {input_path} -> {output_path}")
    
    try:
        # Open and process image
        with Image.open(input_path) as img:
            # Convert to RGB if necessary (for JPEG output)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create white background for transparent images
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Get original dimensions
            original_size = img.size
            logger.debug(f"Original size: {original_size[0]}x{original_size[1]}")
            
            # Resize if image is larger than max_size
            if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
                # Calculate new size maintaining aspect ratio
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                logger.debug(f"Resized to: {img.size[0]}x{img.size[1]}")
            else:
                logger.debug("No resizing needed")
            
            # Auto-orient image based on EXIF data
            img = ImageOps.exif_transpose(img)
            
            # Save optimized image
            img.save(output_path, 'JPEG', quality=quality, optimize=True)
            
            # Get file sizes for comparison
            original_size_bytes = os.path.getsize(input_path)
            optimized_size_bytes = os.path.getsize(output_path)
            size_reduction = ((original_size_bytes - optimized_size_bytes) / original_size_bytes) * 100
            
            logger.info(f"Optimization complete:")
            logger.info(f"  Original: {original_size_bytes:,} bytes")
            logger.info(f"  Optimized: {optimized_size_bytes:,} bytes")
            logger.info(f"  Reduction: {size_reduction:.1f}%")
            
            return output_path
            
    except Exception as e:
        logger.error(f"Error optimizing image: {e}")
        raise


def optimize_image_in_place(image_path: str, max_size: tuple = (1000, 1000), quality: int = 85) -> str:
    """
    Optimize image in place (overwrite original file).
    
    Args:
        image_path: Path to the image to optimize
        max_size: Maximum dimensions as (width, height) tuple (default: 1000x1000)
        quality: JPEG quality (1-100, default: 85)
        
    Returns:
        Path to the optimized image (same as input)
    """
    # Create temporary file for optimization
    temp_path = f"{image_path}.tmp"
    
    try:
        # Optimize to temporary file
        optimize_image(image_path, temp_path, max_size, quality)
        
        # Replace original with optimized version
        os.replace(temp_path, image_path)
        
        logger.info(f"Image optimized in place: {image_path}")
        return image_path
        
    except Exception as e:
        # Clean up temporary file if it exists
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise


if __name__ == "__main__":
    # Test the optimizer
    import logging
    from logging_config import setup_logging
    setup_logging(level=logging.INFO)
    
    # Test with a sample image (if available)
    test_image = "test_image.jpg"
    if os.path.exists(test_image):
        try:
            result = optimize_image(test_image)
            print(f"Optimized image saved to: {result}")
        except Exception as e:
            print(f"Error: {e}")
    else:
        print("No test image found. Create a test image to test the optimizer.")
