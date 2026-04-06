FROM docker:cli
RUN apk add --no-cache git
RUN git config --global --add safe.directory /repo
COPY update.sh /update.sh
RUN chmod +x /update.sh
CMD ["/update.sh"]
