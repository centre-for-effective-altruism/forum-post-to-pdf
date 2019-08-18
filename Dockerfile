FROM pandoc/latex:2.7.3
RUN apk --update --no-cache add python py-pip
RUN pip install --upgrade awscli

WORKDIR /src
COPY run.sh /src
RUN chmod +x /src/run.sh

ENTRYPOINT ["/bin/sh", "/src/run.sh"]