FROM golang:1.23-alpine AS builder
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY backend ./backend
RUN CGO_ENABLED=0 GOOS=linux go build -buildvcs=false -o /out/api ./backend

FROM alpine:3.20
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /out/api .
COPY frontend/src/assets/uploads ./uploads
EXPOSE 8080
CMD ["./api"]
