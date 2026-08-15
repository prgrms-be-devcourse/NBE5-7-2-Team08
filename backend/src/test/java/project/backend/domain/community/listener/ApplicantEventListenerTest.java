package project.backend.domain.community.listener;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import project.backend.domain.community.dto.event.ApplyEvent;
import project.backend.domain.notification.app.NotificationService;
import project.backend.domain.notification.entity.Notification;
import project.backend.domain.notification.entity.NotificationType;
import project.backend.domain.member.entity.Member;

class ApplicantEventListenerTest {

    @Test
    @DisplayName("스터디 신청 알림은 업무 트랜잭션 안에서 WebSocket으로 직접 전송하지 않는다")
    void handleApply_doesNotSendWebSocketDirectly() {
        NotificationService notificationService = mock(NotificationService.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        ApplicantEventListener listener = new ApplicantEventListener(notificationService, eventPublisher);
        Notification saved = mock(Notification.class);
        Member receiver = mock(Member.class);
        Member sender = mock(Member.class);
        when(receiver.getUsername()).thenReturn("author");
        when(sender.getUsername()).thenReturn("applicant");
        when(sender.getNickname()).thenReturn("신청자");
        when(saved.getReceiver()).thenReturn(receiver);
        when(saved.getSender()).thenReturn(sender);
        when(saved.getType()).thenReturn(NotificationType.STUDY_APPLY);
        when(notificationService.saveNotification(any(Notification.class))).thenReturn(saved);

        listener.handleApply(new ApplyEvent(1L, "author", 2L, "applicant", 3L, "post"));

        verify(eventPublisher).publishEvent(any(project.backend.domain.notification.dto.NotificationDto.class));
    }
}
