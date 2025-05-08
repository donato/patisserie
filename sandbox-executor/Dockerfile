FROM python:3.12-slim
RUN pip install jupyter_kernel_gateway requests numpy pandas
RUN pip install jupyter_client notebook
EXPOSE 8888
CMD ["jupyter", "kernelgateway", "--KernelGatewayApp.ip='0.0.0.0'", "--KernelGatewayApp.port=8888", "--KernelGatewayApp.allow_origin='*'"]