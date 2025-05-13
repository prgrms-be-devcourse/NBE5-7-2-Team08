package project.backend.domain.imagefile;

import jakarta.transaction.Transactional;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import project.backend.global.exception.ex.ImageFileException;
import project.backend.global.exception.errorcode.ImageFileErrorCode;

@Service
@Transactional
@RequiredArgsConstructor
public class ImageFileService {

    private final ImageFileRepository imageFileRepository;

    @Value("${file.profile-path}")
    private String profilePath;

    public ImageFile saveProfileImageFile(MultipartFile file) {

        try {
            String uploadFileName = file.getOriginalFilename();

            checkExtension(uploadFileName);
            checkFileTypeIsImage(file.getContentType());

            String extension = uploadFileName.substring(uploadFileName.lastIndexOf(".")).toLowerCase();

            checkFileExtensionIsImage(extension);

            String storeFileName = UUID.randomUUID() + extension;

            Path savePath = Paths.get(profilePath, storeFileName);

            file.transferTo(savePath.toFile());

            return imageFileRepository.save(ImageFile.ofProfile(storeFileName, uploadFileName));

        } catch (IOException e) {
            throw new ImageFileException(ImageFileErrorCode.FILE_SAVE_FAILURE);
        }

    }

    private void checkFileExtensionIsImage(String extension) {
        List<String> imageExtensions = List.of(".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp");
        if (!imageExtensions.contains(extension)) {
            throw new ImageFileException(ImageFileErrorCode.INVALID_IMAGE_TYPE);
        }
    }


    private void checkFileTypeIsImage(String fileType) {
        if (fileType == null || !fileType.startsWith("image/")) {
            throw new ImageFileException(ImageFileErrorCode.INVALID_IMAGE_TYPE);
        }
    }

    private void checkExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            throw new ImageFileException(ImageFileErrorCode.INVALID_IMAGE_TYPE);
        }
    }


    public ImageFile getProfileImageByStoreFileName(String storeFileName) {
        return imageFileRepository.findByUploadFileName(storeFileName)
                .orElseThrow(() -> new ImageFileException(ImageFileErrorCode.FILE_NOT_FOUND));
    }

}
