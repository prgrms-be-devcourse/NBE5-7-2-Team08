package project.backend.domain.member.mapper;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import project.backend.domain.imagefile.ImageFile;
import project.backend.domain.member.dto.MemberResponse;
import project.backend.domain.member.dto.SignUpRequest;
import project.backend.domain.member.entity.Member;

@RequiredArgsConstructor
public class MemberMapper {

    public static Member toEntity(SignUpRequest request, String encryptedPassword, ImageFile defaultProfileImg) {
        return Member.builder()
                .email(request.getEmail())
                .password(encryptedPassword)
                .nickname(request.getNickname())
                .profileImage(defaultProfileImg)
                .build();
    }

    public static MemberResponse toResponse(Member member) {
        return MemberResponse.builder()
                .id(member.getId())
                .email(member.getEmail())
                .nickname(member.getNickname())
                .profileImg(member.getProfileImage().getStoreFileName())
                .build();
    }
}
