FROM golang:1.24.0-alpine3.21 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -ldflags="-w -s" -o axe-backend .
FROM alpine:3.21
RUN apk --no-cache add ca-certificates && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder /app/axe-backend /app/axe-backend
USER app
ENV PORT=8080
EXPOSE 8080
CMD ["./axe-backend"]
