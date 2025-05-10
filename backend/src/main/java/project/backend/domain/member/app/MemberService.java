package project.backend.domain.member.app;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import project.backend.domain.imagefile.ImageFile;
import project.backend.domain.imagefile.ImageFileService;
import project.backend.domain.member.MemberErrorCode;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.dto.MemberResponse;
import project.backend.domain.member.dto.MemberUpdateRequest;
import project.backend.domain.member.dto.SignUpRequest;
import project.backend.domain.member.entity.Member;
import project.backend.domain.member.mapper.MemberMapper;
import project.backend.global.exception.MemberException;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;
    private final ImageFileService imageFileService;
    private final PasswordEncoder passwordEncoder;

    public MemberResponse saveMember(SignUpRequest request) {
        if (checkIfMemberExists(request.getEmail())) {
            log.info("예외 = {}", "이미 존재하는 email");
            throw new MemberException(MemberErrorCode.MEMBER_ALREADY_EXISTS);
        }
 
        ImageFile defaultProfileImg = imageFileService.getProfileImageByStoreFileName(
                "default-profile.png");
        request.setProfile_image(defaultProfileImg);
        request.setPassword(passwordEncoder.encode(request.getPassword()));

        Member newMember = memberRepository.save(MemberMapper.toEntity(request));
        return MemberMapper.toDto(newMember);
    }

    private boolean checkIfMemberExists(String email) {
        return memberRepository.findByEmail(email).isPresent();
    }

    public MemberResponse findMemberByEmail(String email) {
        Member foundMember = memberRepository.findByEmail(email)
                .orElseThrow(() -> new MemberException(MemberErrorCode.MEMBER_NOT_FOUND));

        return MemberMapper.toDto(foundMember);
    }


    public MemberResponse updateMember(Long id, MemberUpdateRequest request) {
        Member targetMember = memberRepository.findById(id)
                .orElseThrow(() -> new MemberException(MemberErrorCode.MEMBER_NOT_FOUND));

        if (request.getNickname() != null) {
            targetMember.setNickname(request.getNickname());
        }

        if (request.getPassword() != null) {
            targetMember.setPassword(request.getPassword());
        }

        if (request.getProfile() != null) {
            ImageFile newProfile = imageFileService.saveProfileImageFile(request.getProfile());
            targetMember.setProfileImage(newProfile);
        }

        return MemberMapper.toDto(targetMember);
    }

}
