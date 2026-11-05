package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.entity.ProfilePhoto;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.repository.ProfilePhotoRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.support.People;
import java.awt.Graphics2D;
import java.awt.Color;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Base64;
import java.util.Optional;
import javax.imageio.ImageReader;
import javax.imageio.ImageIO;
import javax.imageio.stream.ImageInputStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfilePhotoService {
    private static final int MAX_ENCODED_BYTES = 5 * 1024 * 1024;
    private static final int MAX_DIMENSION = 4000;
    private static final int OUTPUT_DIMENSION = 512;
    private static final int MAX_OUTPUT_BYTES = 1024 * 1024;

    private final ProfilePhotoRepository photos;
    private final People people;

    public ProfilePhotoService(ProfilePhotoRepository photos, People people) {
        this.photos = photos;
        this.people = people;
    }

    @Transactional(readOnly = true)
    public Optional<byte[]> get(CurrentUser user) {
        return get(people.me(user).getId());
    }

    @Transactional(readOnly = true)
    public Optional<byte[]> getForEmployee(CurrentUser user, Long employeeId) {
        people.requireAdmin(user);
        people.get(employeeId);
        return get(employeeId);
    }

    private Optional<byte[]> get(Long employeeId) {
        return photos.findById(employeeId).map(ProfilePhoto::getImageData);
    }

    @Transactional
    public void save(CurrentUser user, String encodedImage) {
        save(people.me(user).getId(), encodedImage);
    }

    @Transactional
    public void saveForEmployee(CurrentUser user, Long employeeId, String encodedImage) {
        people.requireAdmin(user);
        people.get(employeeId);
        save(employeeId, encodedImage);
    }

    private void save(Long employeeId, String encodedImage) {
        if (encodedImage == null || encodedImage.isBlank() || encodedImage.length() > MAX_ENCODED_BYTES * 4L / 3L + 8) {
            throw new BadRequestException("Choose an image smaller than 5 MB");
        }

        final byte[] input;
        try {
            input = Base64.getDecoder().decode(encodedImage);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Choose a valid image file");
        }
        if (input.length == 0 || input.length > MAX_ENCODED_BYTES) throw new BadRequestException("Choose an image smaller than 5 MB");

        final BufferedImage source;
        try (ImageInputStream imageInput = ImageIO.createImageInputStream(new ByteArrayInputStream(input))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(imageInput);
            if (!readers.hasNext()) throw new BadRequestException("Choose a valid image file");
            ImageReader reader = readers.next();
            try {
                reader.setInput(imageInput, true, true);
                int imageWidth = reader.getWidth(0);
                int imageHeight = reader.getHeight(0);
                if (imageWidth > MAX_DIMENSION || imageHeight > MAX_DIMENSION || (long) imageWidth * imageHeight > 16_000_000L) {
                    throw new BadRequestException("Image must be a supported format and no larger than 4000 × 4000 pixels");
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

        final byte[] output;
        try (ByteArrayOutputStream stream = new ByteArrayOutputStream()) {
            ImageIO.write(normalized, "jpeg", stream);
            output = stream.toByteArray();
        } catch (IOException e) {
            throw new BadRequestException("Could not process this image");
        }
        if (output.length > MAX_OUTPUT_BYTES) throw new BadRequestException("Image is too large after processing");

        ProfilePhoto photo = new ProfilePhoto();
        photo.setEmployeeId(employeeId);
        photo.setImageData(output);
        photos.save(photo);
    }

    @Transactional
    public void remove(CurrentUser user) {
        photos.deleteById(people.me(user).getId());
    }

    @Transactional
    public void removeForEmployee(CurrentUser user, Long employeeId) {
        people.requireAdmin(user);
        people.get(employeeId);
        photos.deleteById(employeeId);
    }
}
