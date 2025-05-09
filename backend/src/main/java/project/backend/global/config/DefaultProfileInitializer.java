package project.backend.global.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import project.backend.domain.imagefile.ImageFile;
import project.backend.domain.imagefile.ImageFileRepository;
import project.backend.domain.imagefile.ImageType;

@Component
@RequiredArgsConstructor
public class DefaultProfileInitializer {

  private final ImageFileRepository imageFileRepository;

  @PostConstruct
  public void initDefaultImage() {
    boolean exists = imageFileRepository.existsByStoreFileName("default-profile.png");

    if (!exists) {
      imageFileRepository.save(ImageFile.builder()
          .storeFileName("default-profile.png")
          .uploadFileName("default-profile.png")
          .imageType(ImageType.PROFILE_IMAGE)
          .build());
    }
  }
}

