package project.backend.domain.member.dto;

import lombok.Data;
import lombok.Value;
import org.springframework.web.multipart.MultipartFile;

@Data
public class MemberUpdateRequest {

    private String password;
    private String nickname;
    private MultipartFile profileImg;

}
