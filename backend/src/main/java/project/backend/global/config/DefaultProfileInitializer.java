package project.backend.global.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import project.backend.domain.imagefile.ImageFile;
import project.backend.domain.imagefile.ImageFileRepository;
import project.backend.domain.imagefile.ImageType;
import project.backend.domain.member.app.MemberService;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.dto.SignUpRequest;
import project.backend.domain.member.entity.Member;

@Component
@RequiredArgsConstructor
public class DefaultProfileInitializer {

    private final ImageFileRepository imageFileRepository;
    private final MemberService memberService;

    @Value("${file.default-profile}")
    private String defaultProfilePath;

    @PostConstruct
    public void initDefaultImage() {
        boolean exists = imageFileRepository.existsByStoreFileName("/profile/default-profile.png");

        if (!exists) {
            imageFileRepository.save(ImageFile.builder()
                    .storeFileName(defaultProfilePath)
                    .uploadFileName(defaultProfilePath)
                    .imageType(ImageType.PROFILE_IMAGE)
                    .build());

            imageFileRepository.flush();
        }

        SignUpRequest testRequest = new SignUpRequest();
        testRequest.setEmail("test@test.com");
        testRequest.setPassword("test");
        testRequest.setNickname("test");

        memberService.saveMember(testRequest);
    }

}

