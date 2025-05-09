package project.backend.domain.imagefile;

import jakarta.transaction.Transactional;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import project.backend.global.exception.ImageFileException;

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

      if (uploadFileName == null || !uploadFileName.contains(".")) {
        throw new IllegalArgumentException("파일명에 확장자가 없습니다.");
      }
      String extension = uploadFileName.substring(uploadFileName.lastIndexOf("."));
      String storeFileName = UUID.randomUUID() + extension;

      Path savePath = Paths.get(profilePath, storeFileName);

      file.transferTo(savePath.toFile());

      return imageFileRepository.save(ImageFile.builder()
          .uploadFileName(uploadFileName)
          .storeFileName(storeFileName)
          .imageType(ImageType.PROFILE_IMAGE)
          .build()
      );

    } catch (IOException e) {
      throw new ImageFileException(ImageFileErrorCode.FILE_SAVE_FAILURE);
    }

  }

  public ImageFile getProfileImageByStoreFileName(String storeFileName) {
    return imageFileRepository.findByUploadFileName(storeFileName)
        .orElseThrow(() -> new ImageFileException(ImageFileErrorCode.FILE_NOT_FOUND));
  }

}
