FROM golang:alpine AS builder
WORKDIR /app
COPY . .
RUN go build -ldflags="-w -s" -o axe-backend .
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/axe-backend /app/axe-backend
ENV PORT=8080
EXPOSE 8080
CMD ["./axe-backend"]
