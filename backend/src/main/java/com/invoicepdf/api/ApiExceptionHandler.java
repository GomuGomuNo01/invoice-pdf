package com.invoicepdf.api;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import com.invoicepdf.pdf.RenderLimiter;
import com.invoicepdf.web.PayloadTooLargeException;

/**
 * Erreurs normalisées au format RFC 9457 (application/problem+json).
 * Aucun détail interne (trace, message d'exception) n'est renvoyé au client.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<Map<String, String>> errors = ex.getBindingResult().getFieldErrors().stream()
                .sorted(Comparator.comparing(org.springframework.validation.FieldError::getField))
                .map(error -> Map.of(
                        "field", error.getField(),
                        "message", error.getDefaultMessage() == null ? "Valeur invalide." : error.getDefaultMessage()))
                .toList();
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "La facture contient des erreurs.");
        problem.setTitle("Requête invalide");
        problem.setProperty("errors", errors);
        return ResponseEntity.badRequest().body(problem);
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        if (ex.getMostSpecificCause() instanceof PayloadTooLargeException) {
            return payloadTooLarge();
        }
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Le contenu de la requête est illisible ou contient des champs inconnus.");
        problem.setTitle("Requête illisible");
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(PayloadTooLargeException.class)
    public ResponseEntity<Object> handlePayloadTooLarge(PayloadTooLargeException ex) {
        return payloadTooLarge();
    }

    @ExceptionHandler(RenderLimiter.ServerBusyException.class)
    public ResponseEntity<Object> handleServerBusy(RenderLimiter.ServerBusyException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "Le service est très sollicité. Réessayer dans quelques secondes.");
        problem.setTitle("Service occupé");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).header(HttpHeaders.RETRY_AFTER, "5").body(problem);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleUnexpected(Exception ex) {
        LOG.error("unexpected_error type={}", ex.getClass().getName(), ex);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "Une erreur interne est survenue. Réessayer plus tard.");
        problem.setTitle("Erreur interne");
        return ResponseEntity.internalServerError().body(problem);
    }

    private static ResponseEntity<Object> payloadTooLarge() {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONTENT_TOO_LARGE,
                "La requête dépasse la taille maximale autorisée.");
        problem.setTitle("Requête trop volumineuse");
        return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE).body(problem);
    }
}
