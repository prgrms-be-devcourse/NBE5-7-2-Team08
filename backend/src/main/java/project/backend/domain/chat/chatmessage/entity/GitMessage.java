package project.backend.domain.chat.chatmessage.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import project.backend.domain.chat.chatmessage.dto.git.GitEventType;

@Entity
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class GitMessage {

    @Id
    @Column(name = "git_message_id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String content;

    private String url;

    private String title;

    private LocalDateTime sendAt = LocalDateTime.now();

    @Enumerated(EnumType.STRING)
    private GitEventType type;

    private String actor;

}
