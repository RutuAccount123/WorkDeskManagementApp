package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.exception.BadRequestException;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.stereotype.Component;

/** Validates and normalizes task reference images before storing them. */
@Component
public class TaskImageProcessor {
    private static final int MAX_INPUT_BYTES = 5 * 1024 * 1024;
    private static final int MAX_DIMENSION = 4000;
    private static final int OUTPUT_DIMENSION = 512;
    private static final int MAX_OUTPUT_BYTES = 1024 * 1024;

    public byte[] normalize(String encodedImage) {
        if (encodedImage == null) return null;
        if (encodedImage.isBlank() || encodedImage.length() > MAX_INPUT_BYTES * 4L / 3L + 8) {
            throw new BadRequestException("Choose an image smaller than 5 MB");
        }

        final byte[] input;
        try {
            input = Base64.getDecoder().decode(encodedImage);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Choose a valid image file");
        }
        if (input.length == 0 || input.length > MAX_INPUT_BYTES) {
            throw new BadRequestException("Choose an image smaller than 5 MB");
        }

        final BufferedImage source;
        try (ImageInputStream imageInput = ImageIO.createImageInputStream(new ByteArrayInputStream(input))) {
            if (imageInput == null) throw new BadRequestException("Choose a valid image file");
            Iterator<ImageReader> readers = ImageIO.getImageReaders(imageInput);
            if (!readers.hasNext()) throw new BadRequestException("Choose a valid image file");
            ImageReader reader = readers.next();
            try {
                reader.setInput(imageInput, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width > MAX_DIMENSION || height > MAX_DIMENSION || (long) width * height > 16_000_000L) {
                    throw new BadRequestException("Image must be no larger than 4000 × 4000 pixels");
                }
                source = reader.read(0);
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw new BadRequestException("Choose a valid image file");
        }
        if (source == null) throw new BadRequestException("Choose a valid image file");

        double scale = Math.min(1.0, (double) OUTPUT_DIMENSION / Math.max(source.getWidth(), source.getHeight()));
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        BufferedImage normalized = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = normalized.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics.setColor(Color.WHITE);
        graphics.fillRect(0, 0, width, height);
        graphics.drawImage(source, 0, 0, width, height, null);
        graphics.dispose();

        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (!ImageIO.write(normalized, "jpeg", output)) throw new BadRequestException("Could not process this image");
            byte[] result = output.toByteArray();
            if (result.length > MAX_OUTPUT_BYTES) throw new BadRequestException("Image is too large after processing");
            return result;
        } catch (IOException e) {
            throw new BadRequestException("Could not process this image");
        }
    }
}
